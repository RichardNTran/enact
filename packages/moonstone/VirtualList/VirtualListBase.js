/**
 * Exports the {@link module:@enact/moonstone/VirtualList/VirtualListBase~VirtualListBase} component.
 *
 * @module @enact/moonstone/VirtualList/VirtualListBase
 */

import React, {Component, PropTypes} from 'react';

import {Spotlight, SpotlightContainerDecorator} from '@enact/spotlight';

import {dataIndexAttribute, Scrollable} from '../Scroller/Scrollable';

const
	dataContainerDisabledAttribute = 'data-container-disabled',
	dataContainerIdAttribute = 'data-container-id',
	keyLeft	 = 37,
	keyUp	 = 38,
	keyRight = 39,
	keyDown	 = 40,
	nop = () => {};

/**
 * {@link module:@enact/moonstone/VirtualList/VirtualListBase~VirtualListBase} is a base component for
 * {@link module:@enact/moonstone/VirtualList~VirtualList} and
 * {@link module:@enact/moonstone/VirtualList~VirtualGridList} with Scrollable and SpotlightContainerDecorator applied.
 *
 * @class VirtualListBase
 * @mixes module:@enact/moonstone/Scrollable
 * @mixes module:@enact/spotlight/SpotlightContainerDecorator
 * @ui
 * @public
 */
class VirtualListCore extends Component {
	static propTypes = {
		/**
		 * Size of an item for the list; valid values are either a number for `VirtualList`
		 * or an object that has `minWidth` and `minHeight` for `VirtualGridList`.
		 *
		 * @type {Number|Object}
		 * @public
		 */
		itemSize: PropTypes.oneOfType([
			PropTypes.number,
			PropTypes.object
		]).isRequired,

		/**
		 * Callback method of scrollTo.
		 * Normally, `Scrollable` should set this value.
		 *
		 * @type {Function}
		 * @private
		 */
		cbScrollTo: PropTypes.func,

		/**
		 * The render function for an item of the list.
		 * `index` is for accessing the index of the item.
		 * `key` MUST be passed as a prop for DOM recycling.
		 * Data manipulation can be done in this function.
		 *
		 * @type {Function}
		 * @default ({index, key}) => (<div key={key}>{index}</div>)
		 * @public
		 */
		component: PropTypes.func,

		/**
		 * Data for the list.
		 * Check mutation of this and determine whether the list should update or not.
		 *
		 * @type {Any}
		 * @default []
		 * @public
		 */
		data: PropTypes.any,

		/**
		 * Size of the data.
		 *
		 * @type {Number}
		 * @default 0
		 * @public
		 */
		dataSize: PropTypes.number,

		/**
		 * Direction of the list; valid values are `'horizontal'` and `'vertical'`.
		 *
		 * @type {String}
		 * @default 'vertical'
		 * @public
		 */
		direction: PropTypes.oneOf(['horizontal', 'vertical']),

		/**
		 * Direction specific options of the list; valid values are `'fixedHeightVariableWidth'` and `'fixedWidthVariableHeight'`.
		 *
		 * @type {String}
		 * @public
		 */
		directionOption: PropTypes.oneOf(['fixedHeightVariableWidth', 'fixedWidthVariableHeight']),

		/**
		 * Get the number of items for each one row
		 *
		 * @type {Function}
		 * @private
		 */
		getVariableDataSize: PropTypes.func,

		/**
		 * Get variable item size for a row and a column
		 *
		 * @type {Function}
		 * @private
		 */
		getVariableItemSize: PropTypes.func,

		/**
		 * Called when onScroll [events]{@glossary event} occurs.
		 *
		 * @type {Function}
		 * @private
		 */
		onScroll: PropTypes.func,

		/**
		 * Number of spare DOM node.
		 * `3` is good for the default value experimentally and
		 * this value is highly recommended not to be changed by developers.
		 *
		 * @type {Number}
		 * @default 3
		 * @private
		 */
		overhang: PropTypes.number,

		/**
		 * Option for positioning the items; valid values are `'byItem'`, `'byContainer'`,
		 * and `'byBrowser'`.
		 * If `'byItem'`, the list moves each item.
		 * If `'byContainer'`, the list moves the container that contains rendered items.
		 * If `'byBrowser'`, the list scrolls by browser.
		 *
		 * @type {String}
		 * @default 'byItem'
		 * @private
		 */
		positioningOption: PropTypes.oneOf(['byItem', 'byContainer', 'byBrowser']),

		/**
		 * For variable width or variable height, we need to define client width or client height
		 * instead of calculating them from all items.
		 *
		 * @type {Number}
		 * @public
		 */
		variableScrollBoundsSize: PropTypes.number,

		/**
		 * Spacing between items.
		 *
		 * @type {Number}
		 * @default 0
		 * @public
		 */
		spacing: PropTypes.number
	}

	static defaultProps = {
		cbScrollTo: nop,
		component: ({index, key}) => (<div key={key}>{index}</div>),
		data: [],
		dataSize: 0,
		direction: 'vertical',
		getVariableDataSize: nop,
		getVariableItemSize: nop,
		onScroll: nop,
		overhang: 3,
		positioningOption: 'byItem',
		spacing: 0,
		style: {}
	}

	scrollBounds = {
		clientWidth: 0,
		clientHeight: 0,
		scrollWidth: 0,
		scrollHeight: 0,
		maxLeft: 0,
		maxTop: 0
	}

	primary = null
	secondary = null

	isPrimaryDirectionVertical = true
	isItemSized = false

	dimensionToExtent = 0
	curDataSize = 0
	cc = []

	containerRef = null
	wrapperRef = null
	composeItemPosition = null
	positionContainer = null
	job = null

	// spotlight
	nodeIndexToBeBlurred = null
	lastFocusedIndex = null

	constructor (props) {
		const {positioningOption} = props;

		super(props);

		this.state = {
			primaryFirstIndex: 0,
			numOfItems: 0
		};
		this.initContainerRef = this.initRef('containerRef');
		this.initWrapperRef = this.initRef('wrapperRef');

		switch (positioningOption) {
			case 'byItem':
				this.composeItemPosition = this.composeTransform;
				this.positionContainer = nop;
				break;
			case 'byContainer':
				this.composeItemPosition = this.composeLeftTop;
				this.positionContainer = this.applyTransformToContainerNode;
				break;
			case 'byBrowser':
				this.composeItemPosition = this.composeLeftTop;
				this.positionContainer = this.applyScrollLeftTopToWrapperNode;
				break;
		}
	}

	isVertical = () => ((this.props.directionOption === 'fixedHeightVariableWidth') || this.isPrimaryDirectionVertical)

	isHorizontal = () => ((this.props.directionOption === 'fixedHeightVariableWidth') || !this.isPrimaryDirectionVertical)

	getScrollBounds = () => this.scrollBounds

	getGridPosition (index) {
		const
			{dimensionToExtent, primary, secondary} = this,
			primaryPosition = Math.floor(index / dimensionToExtent) * primary.gridSize,
			secondaryPosition = (index % dimensionToExtent) * secondary.gridSize;

		return {primaryPosition, secondaryPosition};
	}

	getItemPosition = (index) => this.gridPositionToItemPosition(this.getGridPosition(index))

	gridPositionToItemPosition = ({primaryPosition, secondaryPosition}) =>
		(this.isPrimaryDirectionVertical ? {left: secondaryPosition, top: primaryPosition} : {left: primaryPosition, top: secondaryPosition})

	getContainerNode = (positioningOption) => {
		if (positioningOption === 'byItem') {
			return this.containerRef;
		} else {
			return this.wrapperRef;
		}
	}

	getClientSize = (node) => {
		return {
			clientWidth: node.clientWidth,
			clientHeight: node.clientHeight
		};
	}

	calculateMetrics (props) {
		const
			{direction, itemSize, positioningOption, spacing} = props,
			node = this.getContainerNode(positioningOption);

		if (!node) {
			return;
		}

		const
			{clientWidth, clientHeight} = this.getClientSize(node),
			heightInfo = {
				clientSize: clientHeight,
				minItemSize: (itemSize.minHeight) ? itemSize.minHeight : null,
				itemSize: itemSize,
				scrollPosition: 0
			},
			widthInfo = {
				clientSize: clientWidth,
				minItemSize: (itemSize.minWidth) ? itemSize.minWidth : null,
				itemSize: itemSize,
				scrollPosition: 0
			};
		let primary, secondary, dimensionToExtent, primaryThresholdBase;

		this.isPrimaryDirectionVertical = (direction === 'vertical');

		if (this.isPrimaryDirectionVertical) {
			primary = heightInfo;
			secondary = widthInfo;
		} else {
			primary = widthInfo;
			secondary = heightInfo;
		}
		dimensionToExtent = 1;

		this.isItemSized = (primary.minItemSize && secondary.minItemSize);

		if (this.isItemSized) {
			// the number of columns is the ratio of the available width plus the spacing
			// by the minimum item width plus the spacing
			dimensionToExtent = Math.max(Math.floor((secondary.clientSize + spacing) / (secondary.minItemSize + spacing)), 1);
			// the actual item width is a ratio of the remaining width after all columns
			// and spacing are accounted for and the number of columns that we know we should have
			secondary.itemSize = Math.round((secondary.clientSize - (spacing * (dimensionToExtent - 1))) / dimensionToExtent);
			// the actual item height is related to the item width
			primary.itemSize = Math.round(primary.minItemSize * (secondary.itemSize / secondary.minItemSize));
		}

		primary.gridSize = primary.itemSize + spacing;
		primary.maxFirstIndex = 0
		primaryThresholdBase = primary.gridSize * 2;
		primary.threshold = {min: -Infinity, max: primaryThresholdBase, base: primaryThresholdBase};

		secondary.gridSize = secondary.itemSize + spacing;

		this.dimensionToExtent = dimensionToExtent;

		this.primary = primary;
		this.secondary = secondary;

		// eslint-disable-next-line react/no-direct-mutation-state
		this.state.primaryFirstIndex = 0;
		// eslint-disable-next-line react/no-direct-mutation-state
		this.state.numOfItems = 0;
	}

	updateStatesAndBounds (props) {
		const
			{dataSize, directionOption, overhang} = props,
			{primaryFirstIndex} = this.state,
			{dimensionToExtent, primary} = this,
			numOfItems = Math.min(dataSize, dimensionToExtent * (Math.ceil(primary.clientSize / primary.gridSize) + overhang));

		primary.maxFirstIndex = dataSize - numOfItems;
		this.curDataSize = dataSize;

		this.setState({primaryFirstIndex: Math.min(primaryFirstIndex, primary.maxFirstIndex), numOfItems});
		this.calculateScrollBounds(props);
		if (directionOption === 'fixedHeightVariableWidth') {
			this.initSecondaryScrollInfo(numOfItems);
		}
	}

	calculateScrollBounds (props) {
		const
			node = this.getContainerNode(props.positioningOption),
			{primary} = this;

		if (!node) {
			return;
		}

		const
			{clientWidth, clientHeight} = this.getClientSize(node),
			{cbScrollTo, directionOption, variableScrollBoundsSize} = this.props,
			{scrollBounds, isPrimaryDirectionVertical} = this;
		let maxPos;

		scrollBounds.clientWidth = clientWidth;
		scrollBounds.clientHeight = clientHeight;
		scrollBounds.scrollWidth = (directionOption === 'fixedHeightVariableWidth') ? variableScrollBoundsSize : this.getScrollWidth();
		scrollBounds.scrollHeight = this.getScrollHeight();
		scrollBounds.maxLeft = Math.max(0, scrollBounds.scrollWidth - clientWidth);
		scrollBounds.maxTop = Math.max(0, scrollBounds.scrollHeight - clientHeight);

		// correct position
		maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft;

		this.syncPrimaryThreshold(maxPos);

		if (primary.scrollPosition > maxPos) {
			cbScrollTo({position: (isPrimaryDirectionVertical) ? {y: maxPos} : {x: maxPos}});
		}
	}

	syncPrimaryThreshold (maxPos) {
		const {threshold} = this.primary;

		if (threshold.max > maxPos) {
			if (maxPos < threshold.base) {
				threshold.max = threshold.base;
				threshold.min = -Infinity;
			} else {
				threshold.max = maxPos;
				threshold.min = maxPos - threshold.base;
			}
		}
	}

	initSecondaryScrollInfo (numOfItems) {
		const
			{dataSize} = this.props,
			{secondary} = this;

		secondary.firstIndices = Array(dataSize);
		secondary.lastIndices = Array(dataSize);
		secondary.positionOffsets = Array(dataSize);
		secondary.thresholds = Array.from({length: dataSize}, () => ({}));

		for (let i = 0; i < numOfItems; i++) {
			this.updateSecondaryScrollInfoWithPrimaryIndex(i, 0);
		}
	}

	updateSecondaryScrollInfoWithPrimaryIndex (primaryIndex, secondaryPosition) {
		const
			{data, getVariableDataSize, getVariableItemSize, variableScrollBoundsSize} = this.props,
			{secondary} = this,
			i = primaryIndex,
			secondaryDataSize = getVariableDataSize({data, fixedIndex: i});
		let
			accumulatedSize = 0,
			width,
			j;

		secondary.positionOffsets[i] = [];
		secondary.thresholds[i] = {};

		for (j = 0; j < secondaryDataSize; j++) {
			width = getVariableItemSize({data, index: {fixed: i, variable: j}});
			secondary.positionOffsets[i][j] = accumulatedSize;
			if (accumulatedSize <= secondaryPosition && secondaryPosition < accumulatedSize + width) {
				secondary.firstIndices[i] = j;
				secondary.thresholds[i].min = accumulatedSize;
			}
			if (accumulatedSize + width > secondaryPosition + secondary.clientSize) {
				secondary.lastIndices[i] = j;
				secondary.thresholds[i].max = accumulatedSize + width;
				break;
			}
			accumulatedSize += width;
		}
		if (j === secondaryDataSize || !secondary.thresholds[i].max) {
			secondary.lastIndices[i] = secondaryDataSize - 1;
			secondary.thresholds[i].max = variableScrollBoundsSize;
		}
	}

	setScrollPosition (x, y, dirX, dirY, skipPositionContainer = false) {
		const
			{directionOption} = this.props,
			{primaryFirstIndex, numOfItems} = this.state,
			{isPrimaryDirectionVertical} = this;
		let
			dir = {primary: 0},
			pos = {primary: 0},
			newPrimaryFirstIndex = primaryFirstIndex,
			shouldUpdateState = false;

		if (directionOption === 'fixedHeightVariableWidth') {
			pos = {primary: y, secondary: x};
			dir = {primary: dirY, secondary: dirX};
		} else if (directionOption === 'fixedWidthVariableHeight') { // TBD : Not implemented yet
			pos = {primary: x, secondary: y};
			dir = {primary: dirX, secondary: dirY};
		} else {
			pos = {primary: isPrimaryDirectionVertical ? y : x};
			dir = {primary: isPrimaryDirectionVertical ? dirY : dirX};
		}

		// for primary direction
		{
			const
				{dimensionToExtent, primary, scrollBounds} = this,
				{gridSize, maxFirstIndex, threshold} = primary,
				maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft,
				maxOfMin = maxPos - minOfMax,
				minOfMax = threshold.base;
			let
				delta,
				numOfGridLines;

			if (dir.primary === 1 && pos.primary > threshold.max) {
				delta = pos.primary - threshold.max;
				numOfGridLines = Math.ceil(delta / gridSize); // how many lines should we add
				threshold.max = Math.min(maxPos, threshold.max + numOfGridLines * gridSize);
				threshold.min = Math.min(maxOfMin, threshold.max - gridSize);
				newPrimaryFirstIndex = Math.min(maxFirstIndex, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) + (numOfGridLines * dimensionToExtent));
			} else if (dir.primary === -1 && pos.primary < threshold.min) {
				delta = threshold.min - pos.primary;
				numOfGridLines = Math.ceil(delta / gridSize);
				threshold.max = Math.max(minOfMax, threshold.min - (numOfGridLines * gridSize - gridSize));
				threshold.min = (threshold.max > minOfMax) ? threshold.max - gridSize : -Infinity;
				newPrimaryFirstIndex = Math.max(0, (dimensionToExtent * Math.ceil(primaryFirstIndex / dimensionToExtent)) - (numOfGridLines * dimensionToExtent));
			}
			this.syncPrimaryThreshold(maxPos);
			primary.scrollPosition = pos.primary;
		}

		// for secondary direction
		if (directionOption === 'fixedHeightVariableWidth') {
			const {clientSize, thresholds: secondaryThresholds} = this.secondary;
			for (let i = newPrimaryFirstIndex; i < newPrimaryFirstIndex + numOfItems; i++) {
				if (
					// primary boundary
					(primaryFirstIndex < newPrimaryFirstIndex && i >= primaryFirstIndex + numOfItems) ||
					(primaryFirstIndex > newPrimaryFirstIndex && i < primaryFirstIndex) ||
					// secondary boundary
					(dir.secondary === 1 && pos.secondary + clientSize > secondaryThresholds[i].max) ||
					(dir.secondary === -1 && pos.secondary < secondaryThresholds[i].min) ||
					// threshold was not defined yet
					(!(secondaryThresholds[i].max || secondaryThresholds[i].min))
				) {
					this.updateSecondaryScrollInfoWithPrimaryIndex(i, pos.secondary);
					shouldUpdateState = true;
				}
			}
			this.secondary.scrollPosition = pos.secondary;
		}

		if (!skipPositionContainer) {
			this.positionContainer();
		}

		if (
			(primaryFirstIndex !== newPrimaryFirstIndex) ||
			(directionOption === 'fixedHeightVariableWidth' && shouldUpdateState === true)
		) {
			this.setState({primaryFirstIndex: newPrimaryFirstIndex});
		} else {
			this.positionItems(this.applyStyleToExistingNode, this.determineUpdatedNeededIndices(primaryFirstIndex));
		}
	}

	determineUpdatedNeededIndices (oldPrimaryFirstIndex) {
		const
			{positioningOption} = this.props,
			{primaryFirstIndex, numOfItems} = this.state;

		if (positioningOption === 'byItem') {
			return {
				updateFrom: primaryFirstIndex,
				updateTo: primaryFirstIndex + numOfItems
			};
		} else {
			const diff = primaryFirstIndex - oldPrimaryFirstIndex;
			return {
				updateFrom: (0 < diff && diff < numOfItems ) ? oldPrimaryFirstIndex + numOfItems : primaryFirstIndex,
				updateTo: (-numOfItems < diff && diff <= 0 ) ? oldPrimaryFirstIndex : primaryFirstIndex + numOfItems
			};
		}
	}

	applyStyleToExistingNode = (params) => {
		const
			{i, key, width, height, primaryPosition, secondaryPosition} = params,
			{directionOption} = this.props,
			node = this.containerRef.children[key];

		if (node) {
			// spotlight
			node.setAttribute(dataIndexAttribute, (directionOption === 'fixedHeightVariableWidth') ? key : i);
			if (key === this.nodeIndexToBeBlurred && i !== this.lastFocusedIndex) {
				node.blur();
				this.nodeIndexToBeBlurred = null;
			}
			this.composeStyle(node.style, width, height, primaryPosition, secondaryPosition);
		}
	}

	applyStyleToNewNode = (params) => {
		const
			{i, j, key, width, height, primaryPosition, secondaryPosition} = params,
			{component, data, directionOption} = this.props,
			itemElement = (directionOption === 'fixedHeightVariableWidth') ?
				component({
					data: data,
					index: {
						fixed: i,
						variable: j
					},
					key: i + '-' + j
				}) :
				component({
					data: data,
					index: i,
					key: key
				}),
			style = {};

		this.composeStyle(style, width, height, primaryPosition, secondaryPosition);

		this.cc[key] = React.cloneElement(
			itemElement, {
				style: {...itemElement.props.style, ...style},
				[dataIndexAttribute]: (directionOption === 'fixedHeightVariableWidth') ? key : i
			}
		);
	}

	positionItems (applyStyle, {updateFrom, updateTo}) {
		const
			{data, positioningOption, directionOption, getVariableItemSize, itemSize} = this.props,
			{numOfItems} = this.state,
			{dimensionToExtent, isPrimaryDirectionVertical, primary, secondary} = this;
		let
			{primaryPosition, secondaryPosition} = this.getGridPosition(updateFrom),
			width,
			height,
			key = 0,
			j;

		primaryPosition -= (positioningOption === 'byItem') ? primary.scrollPosition : 0;
		if (directionOption === 'fixedHeightVariableWidth') {
			secondaryPosition -= (positioningOption === 'byItem') ? secondary.scrollPosition : 0;
			height = itemSize;
		} else {
			width = (isPrimaryDirectionVertical ? secondary.itemSize : primary.itemSize) + 'px';
			height = (isPrimaryDirectionVertical ? primary.itemSize : secondary.itemSize) + 'px';
			j = updateFrom % dimensionToExtent
		}
		// positioning items
		for (let i = updateFrom; i < updateTo; i++) {
			if (directionOption === 'fixedHeightVariableWidth') {
				let position = secondaryPosition + this.secondary.positionOffsets[i][secondary.firstIndices[i]];

				for (j = secondary.firstIndices[i]; j <= secondary.lastIndices[i]; j++) {
					width = getVariableItemSize({data, index: {fixed: i, variable: j}});

					applyStyle({i, j, key, width, height, primaryPosition, secondaryPosition: position});

					position += width;
					key++;
				}
				primaryPosition += primary.gridSize;
			} else {
				key = i % numOfItems;

				applyStyle({i, key, width, height, primaryPosition, secondaryPosition});

				if (++j === dimensionToExtent) {
					secondaryPosition = 0;
					primaryPosition += primary.gridSize;
					j = 0;
				} else {
					secondaryPosition += secondary.gridSize;
				}
			}
		}
	}

	composeStyle (style, width, height, ...rest) {
		const {directionOption} = this.props;

		if (this.isItemSized || directionOption === 'fixedHeightVariableWidth') {
			style.width = width;
			style.height = height;
		}
		this.composeItemPosition(style, ...rest);
	}

	getXY = (primaryPosition, secondaryPosition) => (
		(this.isPrimaryDirectionVertical) ? {x: secondaryPosition, y: primaryPosition} : {x: primaryPosition, y: secondaryPosition}
	)

	composeTransform (style, primaryPosition, secondaryPosition = 0) {
		const {x, y} = this.getXY(primaryPosition, secondaryPosition);
		style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
	}

	composeLeftTop (style, primaryPosition, secondaryPosition = 0) {
		const {x, y} = this.getXY(primaryPosition, secondaryPosition);
		style.left = x + 'px';
		style.top = y + 'px';
	}

	applyTransformToContainerNode () {
		this.composeTransform(this.containerRef.style, -this.primary.scrollPosition, 0);
	}

	applyScrollLeftTopToWrapperNode () {
		const
			node = this.wrapperRef,
			{x, y} = this.getXY(this.primary.scrollPosition, 0);
		node.scrollLeft = x;
		node.scrollTop = y;
	}

	composeOverflow (style) {
		style[this.isPrimaryDirectionVertical ? 'overflowY' : 'overflowX'] = 'scroll';
	}

	getScrollHeight = () => (this.isPrimaryDirectionVertical ? this.getVirtualScrollDimension() : this.scrollBounds.clientHeight)

	getScrollWidth = () => (this.isPrimaryDirectionVertical ? this.scrollBounds.clientWidth : this.getVirtualScrollDimension())

	getVirtualScrollDimension = () => {
		const
			{dimensionToExtent, primary, curDataSize} = this,
			{spacing} = this.props;

		return (Math.ceil(curDataSize / dimensionToExtent) * primary.gridSize) - spacing;
	}

	calculatePositionOnFocus = (focusedIndex) => {
		const
			{primary, numOfItems} = this,
			offsetToClientEnd = primary.clientSize - primary.itemSize;
		let
			gridPosition = this.getGridPosition(focusedIndex);

		this.nodeIndexToBeBlurred = this.lastFocusedIndex % numOfItems;
		this.lastFocusedIndex = focusedIndex;

		if (primary.clientSize >= primary.itemSize) {
			if (gridPosition.primaryPosition > primary.scrollPosition + offsetToClientEnd) {
				gridPosition.primaryPosition -= offsetToClientEnd;
			} else if (gridPosition.primaryPosition > primary.scrollPosition) {
				gridPosition.primaryPosition = primary.scrollPosition;
			}
		}

		// Since the result is used as a target position to be scrolled,
		// scrondaryPosition should be 0 here.
		gridPosition.secondaryPosition = 0;
		return this.gridPositionToItemPosition(gridPosition);
	}

	setRestrict = (bool) => {
		Spotlight.set(this.props[dataContainerIdAttribute], {restrict: (bool) ? 'self-only' : 'self-first'});
	}

	setSpotlightContainerRestrict = (keyCode, index) => {
		const
			{dataSize} = this.props,
			{isPrimaryDirectionVertical, dimensionToExtent} = this,
			canMoveBackward = index >= dimensionToExtent,
			canMoveForward = index < (dataSize - (((dataSize - 1) % dimensionToExtent) + 1));
		let isSelfOnly = false;

		if (isPrimaryDirectionVertical) {
			if (keyCode === keyUp && canMoveBackward || keyCode === keyDown && canMoveForward) {
				isSelfOnly = true;
			}
		} else if (keyCode === keyLeft && canMoveBackward || keyCode === keyRight && canMoveForward) {
			isSelfOnly = true;
		}

		this.setRestrict(isSelfOnly);
	}

	setContainerDisabled = (bool) => {
		const
			{positioningOption} = this.props,
			containerNode = this.getContainerNode(positioningOption);

		if (containerNode) {
			containerNode.setAttribute(dataContainerDisabledAttribute, bool);
		}
	}

	updateClientSize = () => {
		const
			{positioningOption} = this.props,
			node = this.getContainerNode(positioningOption);

		if (!node) {
			return;
		}

		const
			{isPrimaryDirectionVertical, primary} = this,
			{clientWidth, clientHeight} = this.getClientSize(node);

		if (isPrimaryDirectionVertical) {
			primary.clientSize = clientHeight;
		} else {
			primary.clientSize = clientWidth;
		}

		this.updateStatesAndBounds(this.props);
	}

	// Calculate metrics for VirtualList after the 1st render to know client W/H.
	// We separate code related with data due to re use it when data changed.
	componentDidMount () {
		const {positioningOption} = this.props;

		this.calculateMetrics(this.props);
		this.updateStatesAndBounds(this.props);

		if (positioningOption !== 'byBrowser') {
			const containerNode = this.getContainerNode(positioningOption);

			// prevent native scrolling by Spotlight
			this.preventScroll = function () {
				containerNode.scrollTop = 0;
				containerNode.scrollLeft = 0;
			};

			if (containerNode && containerNode.addEventListener) {
				containerNode.addEventListener('scroll', this.preventScroll);
			}
		}
	}

	// Call updateStatesAndBounds here when dataSize has been changed to update nomOfItems state.
	// Calling setState within componentWillReceivePropswill not trigger an additional render.
	componentWillReceiveProps (nextProps) {
		const
			{direction, itemSize, dataSize, overhang, spacing} = this.props,
			hasMetricsChanged = (
				direction !== nextProps.direction ||
				((itemSize instanceof Object) ? (itemSize.minWidth !== nextProps.itemSize.minWidth || itemSize.minHeight !== nextProps.itemSize.minHeight) : itemSize !== nextProps.itemSize) ||
				overhang !== nextProps.overhang ||
				spacing !== nextProps.spacing
			),
			hasDataChanged = (dataSize !== nextProps.dataSize);

		if (hasMetricsChanged) {
			this.calculateMetrics(nextProps);
			this.updateStatesAndBounds(hasDataChanged ? nextProps : this.props);
		} else if (hasDataChanged) {
			this.updateStatesAndBounds(nextProps);
		}
	}

	componentWillUnmount () {
		const
			{positioningOption} = this.props,
			containerNode = this.getContainerNode(positioningOption);

		// remove a function for preventing native scrolling by Spotlight
		if (containerNode && containerNode.removeEventListener) {
			containerNode.removeEventListener('scroll', this.preventScroll);
		}
	}

	// render

	initRef (prop) {
		return (ref) => {
			this[prop] = ref;
		};
	}

	renderCalculate () {
		const
			{dataSize} = this.props,
			{primaryFirstIndex, numOfItems} = this.state,
			max = Math.min(dataSize, primaryFirstIndex + numOfItems);

		this.cc.length = 0;

		this.positionItems(this.applyStyleToNewNode, {updateFrom: primaryFirstIndex, updateTo: max});
		this.positionContainer();
	}

	render () {
		const
			props = Object.assign({}, this.props),
			{positioningOption, onScroll} = this.props,
			{primary, cc} = this;

		delete props.cbScrollTo;
		delete props.component;
		delete props.data;
		delete props.dataSize;
		delete props.direction;
		delete props.directionOption;
		delete props.getVariableDataSize;
		delete props.getVariableItemSize;
		delete props.hideScrollbars;
		delete props.itemSize;
		delete props.onScroll;
		delete props.onScrolling;
		delete props.onScrollStart;
		delete props.onScrollStop;
		delete props.overhang;
		delete props.positioningOption;
		delete props.variableScrollBoundsSize;
		delete props.spacing;

		if (primary) {
			this.renderCalculate();
		}

		if (positioningOption === 'byItem') {
			return (
				<div {...props} ref={this.initContainerRef}>
					{cc}
				</div>
			);
		} else {
			const {className, style, ...rest} = props;

			if (positioningOption === 'byBrowser') {
				this.composeOverflow(style);
			}

			return (
				<div ref={this.initWrapperRef} className={className} style={style} onScroll={onScroll}>
					<div {...rest} ref={this.initContainerRef}>
						{cc}
					</div>
				</div>
			);
		}
	}
}

const VirtualListBase = SpotlightContainerDecorator({restrict: 'self-first'}, Scrollable(VirtualListCore));

export default VirtualListBase;
export {VirtualListCore, VirtualListBase};
