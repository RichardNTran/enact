/**
 * Provides Moonstone-themed virtual list components and behaviors.
 *
 * @module moonstone/VirtualList
 * @exports VirtualList
 * @exports VirtualGridList
 * @exports VirtualListBase
 * @exports VirtualListNative
 * @exports VirtualGridListNative
 * @exports VirtualListBaseNative
 */

import clamp from 'ramda/src/clamp';
import classNames from 'classnames';
import compose from 'ramda/src/compose';
import {contextTypes} from '@enact/i18n/I18nDecorator';
import css from '@enact/ui/VirtualList/ListItem.less';
import {forward} from '@enact/core/handle';
import {is} from '@enact/core/keymap';
import PropTypes from 'prop-types';
import React from 'react';
import Spotlight, {getDirection} from '@enact/spotlight';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spottable from '@enact/spotlight/Spottable';
import {VirtualListBase as UiVirtualListBase} from '@enact/ui/VirtualList';
import {VirtualListBaseNative as UiVirtualListBaseNative} from '@enact/ui/VirtualList/VirtualListNative';

import {Scrollable, dataIndexAttribute} from '../Scrollable';
import ScrollableNative from '../Scrollable/ScrollableNative';

const
	SpotlightPlaceholder = Spottable('div'),
	SpotlightContainerConfig = {
		enterTo: 'last-focused',
		/*
		 * Returns the data-index as the key for last focused
		 */
		lastFocusedPersist: (node) => {
			const indexed = node.dataset.index ? node : node.closest('[data-index]');
			if (indexed) {
				return {
					container: false,
					element: true,
					key: indexed.dataset.index
				};
			}
		},
		/*
		 * Restores the data-index into the placeholder if its the only element. Tries to find a
		 * matching child otherwise.
		 */
		lastFocusedRestore: ({key}, all) => {
			if (all.length === 1 && 'vlPlaceholder' in all[0].dataset) {
				all[0].dataset.index = key;

				return all[0];
			}

			return all.reduce((focused, node) => {
				return focused || node.dataset.index === key && node;
			}, null);
		},
		preserveId: true,
		restrict: 'self-first'
	};

const
	dataContainerDisabledAttribute = 'data-container-disabled',
	forwardKeyDown = forward('onKeyDown'),
	isDown = is('down'),
	isLeft = is('left'),
	isRight = is('right'),
	isUp = is('up');

/**
 * [VirtualListBase]{@link moonstone/VirtualList.VirtualListBase} is a base component for
 * [VirtualList]{@link moonstone/VirtualList.VirtualList} and
 * [VirtualGridList]{@link moonstone/VirtualList.VirtualGridList}.
 *
 * @class VirtualListBase
 * @memberof moonstone/VirtualList
 * @ui
 * @private
 */
const VirtualListBase = (type, UiComponent) => (
	class VirtualListCore extends UiComponent {
		static displayName = 'VirtualListBase'

		static propTypes = /** @lends moonstone/VirtualList.VirtualListBase.prototype */ {
			/**
			 * Spotlight container Id
			 *
			 * @type {String}
			 * @private
			 */
			'data-container-id': PropTypes.string // eslint-disable-line react/sort-prop-types
		}

		static contextTypes = contextTypes

		constructor (props) {
			super(props);

			this.initItemContainerRef = this.initRef('itemContainerRef');
		}

		componentDidMount () {
			super.componentDidMount();

			if (type == 'JS') {
				const containerNode = this.containerRef;

				// prevent native scrolling by Spotlight
				this.preventScroll = () => {
					containerNode.scrollTop = 0;
					containerNode.scrollLeft = this.context.rtl ? containerNode.scrollWidth : 0;
				};

				if (containerNode && containerNode.addEventListener) {
					containerNode.addEventListener('scroll', this.preventScroll);
				}
			}
		}

		componentDidUpdate () {
			this.restoreFocus();
		}

		componentWillUnmount () {
			if (this.setContainerDisabled) {
				this.setContainerDisabled(false);
			}
		}

		isScrolledBy5way = false
		isScrolledByJump = false
		lastFocusedIndex = null
		nodeIndexToBeFocused = null
		preservedIndex = null
		restoreLastFocused = false

		itemContainerRef = null

		setContainerDisabled = (bool) => {
			const containerNode = (type === 'JS') ? this.containerRef : this.contentRef;

			if (containerNode) {
				containerNode.setAttribute(dataContainerDisabledAttribute, bool);

				if (bool) {
					document.addEventListener('keydown', this.handleGlobalKeyDown, {capture: true});
				} else {
					document.removeEventListener('keydown', this.handleGlobalKeyDown, {capture: true});
				}
			}
		}

		/**
		 * Handle a Page up/down key with disabled items
		 */

		findSpottableItem = (indexFrom, indexTo) => {
			const
				{data, dataSize} = this.props,
				safeIndexFrom = clamp(0, dataSize - 1, indexFrom),
				safeIndexTo = clamp(-1, dataSize, indexTo),
				delta = (indexFrom < indexTo) ? 1 : -1;

			if (indexFrom < 0 && indexTo < 0 || indexFrom >= dataSize && indexTo >= dataSize) {
				return -1;
			}

			if (safeIndexFrom !== safeIndexTo) {
				for (let i = safeIndexFrom; i !== safeIndexTo; i += delta) {
					if (data[i] && data[i].disabled === false) {
						return i;
					}
				}
			}

			return -1;
		}

		getIndexToScrollDisabled = (direction, currentIndex) => {
			const
				{data, dataSize, spacing} = this.props,
				{dimensionToExtent, primary, findSpottableItem} = this,
				{firstVisibleIndex, lastVisibleIndex} = this.moreInfo,
				numOfItemsInPage = (Math.floor((primary.clientSize + spacing) / primary.gridSize) * dimensionToExtent),
				isPageDown = (direction === 'down' || direction === 'right') ? 1 : -1;
			let candidateIndex = -1;

			/* First, find a spottable item in this page */
			if (isPageDown === 1) { // Page Down
				if ((lastVisibleIndex - (lastVisibleIndex % dimensionToExtent || dimensionToExtent)) >= currentIndex) {
					candidateIndex = findSpottableItem(
						lastVisibleIndex,
						currentIndex - (currentIndex % dimensionToExtent) + dimensionToExtent - 1
					);
				}
			} else if (firstVisibleIndex + dimensionToExtent <= currentIndex) { // Page Up
				candidateIndex = findSpottableItem(
					firstVisibleIndex,
					currentIndex - (currentIndex % dimensionToExtent)
				);
			}

			/* Second, find a spottable item in the next page */
			if (candidateIndex === -1) {
				if (isPageDown === 1) { // Page Down
					candidateIndex = findSpottableItem(lastVisibleIndex + numOfItemsInPage, lastVisibleIndex);
				} else { // Page Up
					candidateIndex = findSpottableItem(firstVisibleIndex - numOfItemsInPage, firstVisibleIndex);
				}
			}

			/* Last, find a spottable item in a whole data */
			if (candidateIndex === -1) {
				if (isPageDown === 1) { // Page Down
					candidateIndex = findSpottableItem(lastVisibleIndex + numOfItemsInPage + 1, dataSize);
				} else { // Page Up
					candidateIndex = findSpottableItem(firstVisibleIndex - numOfItemsInPage - 1, -1);
				}
			}

			/* For grid lists, find the nearest item from the current item */
			if (candidateIndex !== -1) {
				const
					currentPosInExtent = currentIndex % dimensionToExtent,
					firstIndexInExtent = candidateIndex - (candidateIndex % dimensionToExtent),
					lastIndexInExtent = clamp(firstIndexInExtent, dataSize - 1, firstIndexInExtent + dimensionToExtent);
				let
					minDistance = dimensionToExtent,
					distance,
					index;
				for (let i = firstIndexInExtent; i <= lastIndexInExtent; ++i) {
					if (data[i] && !data[i].disabled) {
						distance = Math.abs(currentPosInExtent - i % dimensionToExtent);
						if (distance < minDistance) {
							minDistance = distance;
							index = i;
						}
					}
				}

				return index;
			} else {
				return -1;
			}
		}

		getIndexToScroll = (direction, currentIndex) => {
			const
				{dataSize, spacing} = this.props,
				{dimensionToExtent, primary} = this,
				numOfItemsInPage = Math.floor((primary.clientSize + spacing) / primary.gridSize) * dimensionToExtent,
				factor = (direction === 'down' || direction === 'right') ? 1 : -1;
			let indexToScroll = currentIndex + factor * numOfItemsInPage;

			if (indexToScroll < 0) {
				indexToScroll = currentIndex % dimensionToExtent;
			} else if (indexToScroll >= dataSize) {
				indexToScroll = dataSize - dataSize % dimensionToExtent + currentIndex % dimensionToExtent;
				if (indexToScroll >= dataSize) {
					indexToScroll = dataSize - 1;
				}
			}

			return indexToScroll === currentIndex ? -1 : indexToScroll;
		}

		scrollToNextItem = ({direction, focusedItem}) => {
			const
				{data} = this.props,
				focusedIndex = Number.parseInt(focusedItem.getAttribute(dataIndexAttribute)),
				{firstVisibleIndex, lastVisibleIndex} = this.moreInfo;
			let indexToScroll = -1;

			if (Array.isArray(data) && data.some((item) => item.disabled)) {
				indexToScroll = this.getIndexToScrollDisabled(direction, focusedIndex);
			} else {
				indexToScroll = this.getIndexToScroll(direction, focusedIndex);
			}

			if (indexToScroll !== -1) {
				const
					isRtl = this.context.rtl,
					isForward = (direction === 'down' || isRtl && direction === 'left' || !isRtl && direction === 'right');

				if (type === 'JS') {
					// To prevent item positioning issue, make all items to be rendered.
					this.updateFrom = null;
					this.updateTo = null;
				}

				if (firstVisibleIndex <= indexToScroll && indexToScroll <= lastVisibleIndex) {
					const node = this.containerRef.querySelector(`[data-index='${indexToScroll}'].spottable`);

					if (node) {
						Spotlight.focus(node);
					}
				} else {
					// Scroll to the next spottable item without animation
					if (!Spotlight.isPaused()) {
						Spotlight.pause();
					}
					focusedItem.blur();
				}
				this.nodeIndexToBeFocused = this.lastFocusedIndex = indexToScroll;
				this.props.cbScrollTo({index: indexToScroll, stickTo: isForward ? 'end' : 'start', animate: false});
			}

			return true;
		}

		/**
		 * Handle `onKeyDown` event
		 */

		setRestrict = (bool) => {
			Spotlight.set(this.props['data-container-id'], {restrict: (bool) ? 'self-only' : 'self-first'});
		}

		setSpotlightContainerRestrict = (keyCode, target) => {
			const
				{dataSize} = this.props,
				{isPrimaryDirectionVertical, dimensionToExtent} = this,
				index = Number.parseInt(target.getAttribute(dataIndexAttribute)),
				canMoveBackward = index >= dimensionToExtent,
				canMoveForward = index < (dataSize - (((dataSize - 1) % dimensionToExtent) + 1));
			let isSelfOnly = false;

			if (isPrimaryDirectionVertical) {
				if (isUp(keyCode) && canMoveBackward || isDown(keyCode) && canMoveForward) {
					isSelfOnly = true;
				}
			} else if (isLeft(keyCode) && canMoveBackward || isRight(keyCode) && canMoveForward) {
				isSelfOnly = true;
			}

			this.setRestrict(isSelfOnly);
		}

		jumpToSpottableItem = (keyCode, target) => {
			const
				{cbScrollTo, data, dataSize} = this.props,
				{firstIndex, numOfItems} = this.state,
				{isPrimaryDirectionVertical} = this,
				rtl = this.context.rtl,
				currentIndex = Number.parseInt(target.getAttribute(dataIndexAttribute));

			if (!data || !Array.isArray(data) || !data[currentIndex] || data[currentIndex].disabled) {
				return false;
			}

			const
				isForward = (
					isPrimaryDirectionVertical && isDown(keyCode) ||
					!isPrimaryDirectionVertical && (!rtl && isRight(keyCode) || rtl && isLeft(keyCode)) ||
					null
				),
				isBackward = (
					isPrimaryDirectionVertical && isUp(keyCode) ||
					!isPrimaryDirectionVertical && (!rtl && isLeft(keyCode) || rtl && isRight(keyCode)) ||
					null
				);

			let nextIndex = -1;

			if (isForward) {
				// See if the next item is spottable then delegate scroll to onFocus handler
				if (currentIndex < dataSize - 1 && !data[currentIndex + 1].disabled) {
					return false;
				}

				for (let i = currentIndex + 2; i < dataSize; i++) {
					if (!data[i].disabled) {
						nextIndex = i;
						break;
					}
				}

				// If there is no item which could get focus forward,
				// we need to set restriction option to `self-first`.
				if (nextIndex === -1) {
					this.setRestrict(false);
				}
			} else if (isBackward) {
				// See if the next item is spottable then delegate scroll to onFocus handler
				if (currentIndex > 0 && !data[currentIndex - 1].disabled) {
					return false;
				}

				for (let i = currentIndex - 2; i >= 0; i--) {
					if (!data[i].disabled) {
						nextIndex = i;
						break;
					}
				}

				// If there is no item which could get focus backward,
				// we need to set restriction option to `self-first`.
				if (nextIndex === -1) {
					this.setRestrict(false);
				}
			} else {
				return false;
			}

			if (nextIndex !== -1 && (firstIndex > nextIndex || nextIndex >= firstIndex + numOfItems)) {
				// When changing from "pointer" mode to "5way key" mode,
				// a pointer is hidden and a last focused item get focused after 30ms.
				// To make sure the item to be blurred after that, we used 50ms.
				setTimeout(() => {
					target.blur();
				}, 50);

				this.nodeIndexToBeFocused = this.lastFocusedIndex = nextIndex;

				if (!Spotlight.isPaused()) {
					Spotlight.pause();
				}

				cbScrollTo({
					index: nextIndex,
					stickTo: isForward ? 'end' : 'start'
				});
				return true;
			}

			return false;
		}

		onKeyDown = (e) => {
			const {keyCode, target} = e;

			this.isScrolledBy5way = false;
			if (getDirection(keyCode)) {
				if (type === 'Native') {
					e.preventDefault();
				}
				this.setSpotlightContainerRestrict(keyCode, target);
				this.isScrolledBy5way = this.jumpToSpottableItem(keyCode, target);
			}
			forwardKeyDown(e, this.props);
		}

		/**
		 * Handle global `onKeyDown` event
		 */

		handleGlobalKeyDown = () => {
			this.setContainerDisabled(false);
		}

		/**
		 * Focus on the Node of the VirtualList item
		 */

		focusOnNode = (node) => {
			if (node) {
				Spotlight.focus(node);
			}
		}

		focusOnItem = (index) => {
			const item = this.containerRef.querySelector(`[data-index='${index}'].spottable`);

			if (Spotlight.isPaused()) {
				Spotlight.resume();
				if (type === 'JS') {
					this.forceUpdate();
				}
			}
			this.focusOnNode(item);
			this.nodeIndexToBeFocused = null;
		}

		initItemRef = (ref, index) => {
			if (ref) {
				if (type === 'JS') {
					this.focusOnItem(index);
				} else if (type === 'Native') {
					// If focusing the item of VirtuallistNative, `onFocus` in Scrollable will be called.
					// Then VirtualListNative tries to scroll again differently from VirtualList.
					// So we would like to skip `focus` handling when focusing the item as a workaround.
					this.isScrolledByJump = true;
					this.focusOnItem(index);
					this.isScrolledByJump = false;
				}
			}
		}

		focusByIndex = (index) => {
			// We have to focus node async for now since list items are not yet ready when it reaches componentDid* lifecycle methods
			setTimeout(() => {
				this.focusOnItem(index);
			}, 0);
		}

		/**
		 * Manage a placeholder
		 */

		isNeededScrollingPlaceholder = () => this.nodeIndexToBeFocused != null && Spotlight.isPaused();

		handlePlaceholderFocus = (ev) => {
			const placeholder = ev.currentTarget;

			if (placeholder) {
				const index = placeholder.dataset.index;

				if (index) {
					this.preservedIndex = parseInt(index);
					this.restoreLastFocused = true;
				}
			}
		}

		/**
		 * Restore the focus of VirtualList
		 */

		isPlaceholderFocused = () => {
			const current = Spotlight.getCurrent();

			if (current && current.dataset.vlPlaceholder && this.containerRef.contains(current)) {
				return true;
			}

			return false;
		}

		restoreFocus = () => {
			if (
				this.restoreLastFocused &&
				!this.isPlaceholderFocused()
			) {
				const
					containerId = this.props['data-container-id'],
					node = this.containerRef.querySelector(
						`[data-container-id="${containerId}"] [data-index="${this.preservedIndex}"]`
					);

				if (node) {
					// if we're supposed to restore focus and virtual list has positioned a set of items
					// that includes lastFocusedIndex, clear the indicator
					this.restoreLastFocused = false;

					// try to focus the last focused item
					const foundLastFocused = Spotlight.focus(node);

					// but if that fails (because it isn't found or is disabled), focus the container so
					// spotlight isn't lost
					if (!foundLastFocused) {
						this.restoreLastFocused = true;
						Spotlight.focus(containerId);
					}
				}
			}
		}

		/**
		 * calculator
		 */

		calculatePositionOnFocus = ({item, scrollPosition = this.scrollPosition}) => {
			const
				{pageScroll} = this.props,
				{numOfItems} = this.state,
				{primary} = this,
				offsetToClientEnd = primary.clientSize - primary.itemSize,
				focusedIndex = Number.parseInt(item.getAttribute(dataIndexAttribute));

			if (!isNaN(focusedIndex)) {
				let gridPosition = this.getGridPosition(focusedIndex);

				if (numOfItems > 0 && focusedIndex % numOfItems !== this.lastFocusedIndex % numOfItems) {
					const node = this.getItemNode(this.lastFocusedIndex);

					if (node) {
						node.blur();
					}
				}
				if (type === 'JS') {
					this.nodeIndexToBeFocused = null;
					this.lastFocusedIndex = focusedIndex;
				} else if (type === 'Native') {
					this.lastFocusedIndex = focusedIndex;
				}

				if (primary.clientSize >= primary.itemSize) {
					if (gridPosition.primaryPosition > scrollPosition + offsetToClientEnd) { // forward over
						gridPosition.primaryPosition -= pageScroll ? 0 : offsetToClientEnd;
					} else if (gridPosition.primaryPosition >= scrollPosition) { // inside of client
						if (type === 'JS') {
							gridPosition.primaryPosition = scrollPosition;
						} else {
							// This code uses the trick to change the target position slightly which will not affect the actual result
							// since a browser ignore `scrollTo` method if the target position is same as the current position.
							gridPosition.primaryPosition = scrollPosition + (this.scrollPosition === scrollPosition ? 0.1 : 0);
						}
					} else { // backward over
						gridPosition.primaryPosition -= pageScroll ? offsetToClientEnd : 0;
					}
				}

				// Since the result is used as a target position to be scrolled,
				// scrondaryPosition should be 0 here.
				gridPosition.secondaryPosition = 0;

				return this.gridPositionToItemPosition(gridPosition);
			}
		}

		/**
		 * setter/getter
		 */

		shouldPreventScrollByFocus = () => ((type === 'Native') ? (this.isScrolledBy5way || this.isScrolledByJump) : (this.isScrolledBy5way))

		getNodeIndexToBeFocused = () => this.nodeIndexToBeFocused

		setNodeIndexToBeFocused = (param) => {
			this.nodeIndexToBeFocused = param;
		}

		setLastFocusedIndex = (param) => {
			this.lastFocusedIndex = param;
		}

		/**
		 * override
		 */

		updateStatesAndBounds (props) {
			const
				{dataSize, overhang} = props,
				{firstIndex} = this.state,
				{dimensionToExtent, primary, moreInfo, scrollPosition, preservedIndex} = this,
				numOfItems = Math.min(dataSize, dimensionToExtent * (Math.ceil(primary.clientSize / primary.gridSize) + overhang)),
				wasFirstIndexMax = ((this.maxFirstIndex < moreInfo.firstVisibleIndex - dimensionToExtent) && (firstIndex === this.maxFirstIndex)),
				dataSizeDiff = dataSize - this.curDataSize;
			let newFirstIndex = firstIndex;

			this.maxFirstIndex = Math.ceil((dataSize - numOfItems) / dimensionToExtent) * dimensionToExtent;
			this.curDataSize = dataSize;
			this.updateFrom = null;
			this.updateTo = null;

			// reset children
			this.cc = [];
			this.calculateScrollBounds(props);
			this.updateMoreInfo(dataSize, scrollPosition);

			if (this.restoreLastFocused &&
				numOfItems > 0 &&
				(preservedIndex < dataSize) &&
				(preservedIndex < moreInfo.firstVisibleIndex || preservedIndex > moreInfo.lastVisibleIndex)) {
				// If we need to restore last focus and the index is beyond the screen,
				// we call `scrollTo` to create DOM for it.
				this.props.cbScrollTo({index: preservedIndex, animate: false});
			} else {
				newFirstIndex = this.calculateFirstIndex(props, wasFirstIndexMax, dataSizeDiff);
			}

			this.setState({firstIndex: newFirstIndex, numOfItems});
		}

		applyStyleToExistingNode = (index, ...rest) => {
			const node = this.getItemNode(index);

			if (node) {
				this.composeStyle(node.style, ...rest);
			}
		}

		applyStyleToNewNode = (index, ...rest) => {
			const
				{component, data} = this.props,
				{numOfItems} = this.state,
				{getNodeIndexToBeFocused, initItemRef} = this,
				key = index % numOfItems,
				itemElement = component({
					data,
					[dataIndexAttribute]: index,
					index,
					key
				}),
				style = {};

			this.composeStyle(style, ...rest);

			this.cc[key] = React.cloneElement(itemElement, {
				ref: (index === getNodeIndexToBeFocused()) ? (ref) => initItemRef(ref, index) : null,
				className: classNames(css.listItem, itemElement.props.className),
				style: {...itemElement.props.style, ...style}
			});
		}

		applyStyleToHideNode = (index) => {
			const
				key = index % this.state.numOfItems,
				style = {display: 'none'},
				attributes = {[dataIndexAttribute]: index, key, style};

			this.cc[key] = (<div {...attributes} />);
		}

		getXY = (primaryPosition, secondaryPosition) => {
			const rtlDirection = this.context.rtl ? -1 : 1;
			return (this.isPrimaryDirectionVertical ? {x: (secondaryPosition * rtlDirection), y: primaryPosition} : {x: (primaryPosition * rtlDirection), y: secondaryPosition});
		}

		getItemNode = (index) => {
			const ref = this.itemContainerRef;
			return ref ? ref.children[index % this.state.numOfItems] : null;
		}

		scrollToPosition (x, y) {
			const node = this.containerRef;

			node.scrollTo((this.context.rtl && !this.isPrimaryDirectionVertical) ? this.scrollBounds.maxLeft - x : x, y);
		}

		/**
		 * render
		 */

		renderChildren = () => {
			const
				{cc, primary} = this,
				needsScrollingPlaceholder = this.isNeededScrollingPlaceholder();

			return [
				cc.length ? <div key="0" ref={this.initItemContainerRef}>{cc}</div> : null,
				primary ?
					null :
					<SpotlightPlaceholder
						data-index={0}
						data-vl-placeholder
						key="1"
						onFocus={this.handlePlaceholderFocus}
						role="region"
					/>,
				needsScrollingPlaceholder ? <SpotlightPlaceholder key="2" /> : null
			];
		}
	}
);

/**
 * Moonstone-specific VirtualList behavior to apply to
 * [VirtualList]{@link moonstone/VirtualList.VirtualList} and [VirtualGridList]{@link moonstone/VirtualList.VirtualGridList}.
 *
 * @hoc
 * @memberof moonstone/VirtualList
 * @mixes moonstone/Scrollable.Scrollable
 * @ui
 * @private
 */
const VirtualListDecorator = compose(
	SpotlightContainerDecorator(SpotlightContainerConfig),
	Scrollable
);

/**
 * Moonstone-specific VirtualList native behavior to apply to
 * [VirtualListNative]{@link moonstone/VirtualList.VirtualListNative} and [VirtualGridListNative]{@link moonstone/VirtualList.VirtualGridListNative}.
 *
 * @hoc
 * @memberof moonstone/VirtualList
 * @mixes moonstone/Scrollable.ScrollableNative
 * @ui
 * @private
 */
const VirtualListNativeDecorator = compose(
	SpotlightContainerDecorator(SpotlightContainerConfig),
	ScrollableNative
);

/**
 * [VirtualList]{@link moonstone/VirtualList} is
 * a scrollable and spottable virtual list component with Moonstone styling.
 *
 * @class VirtualList
 * @memberof moonstone/VirtualList
 * @mixes moonstone/Scrollable.Scrollable
 * @ui
 * @public
 */
const VirtualList = VirtualListDecorator(VirtualListBase('JS', UiVirtualListBase));

/**
 * [VirtualGridList]{@link moonstone/VirtualList.VirtualGridList} is
 * a scrollable and spottable virtual grid list component with Moonstone styling.
 *
 * @class VirtualGridList
 * @memberof moonstone/VirtualList
 * @mixes moonstone/Scrollable.Scrollable
 * @ui
 * @public
 */
const VirtualGridList = VirtualList;

/**
 * [VirtualListNative]{@link moonstone/VirtualList.VirtualListNative} is
 * a scrollable and spottable virtual list component with Moonstone styling.
 *
 * @class VirtualListNative
 * @memberof moonstone/VirtualList
 * @mixes moonstone/Scrollable.ScrollableNative
 * @ui
 * @public
 */
const VirtualListNative = VirtualListNativeDecorator(VirtualListBase('Native', UiVirtualListBaseNative));

/**
 * [VirtualGridListNative]{@link moonstone/VirtualList.VirtualGridListNative} is
 * a scrollable and spottable virtual grid list component with Moonstone styling.
 *
 * @class VirtualGridListNative
 * @memberof moonstone/VirtualList
 * @mixes moonstone/Scrollable.ScrollableNative
 * @ui
 * @public
 */
const VirtualGridListNative = VirtualListNative;

export default VirtualList;
export {
	VirtualList,
	VirtualGridList,
	VirtualListNative,
	VirtualGridListNative,
	UiVirtualListBase as VirtualListBase,
	UiVirtualListBaseNative as VirtualListBaseNative
};
export * from './GridListImageItem';
