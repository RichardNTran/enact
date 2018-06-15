/**
 * This component allows you to transition its children components onto the screen, whether that's
 * from off the edge of the screen or hidden inside or behind an already-on-screen component.
 * You can switch types of transitions using the `type` property, change the direction they come in
 * from using the `direction` property, or even adjust the transition timing function using
 * `timingFunction`.
 *
 * @example
 * <Transition visible={true} type="slide">
 * 	<div>Set `visible` above to `false` to hide this element.</div>
 * </Transition>
 *
 * @module ui/Transition
 * @exports Transition
 * @exports TransitionBase
 */

import {forward} from '@enact/core/handle';
import hoc from '@enact/core/hoc';
import kind from '@enact/core/kind';
import {Job} from '@enact/core/util';
import PropTypes from 'prop-types';
import React from 'react';

import {ResizeContentConsumerDecorator} from '../internal/ResizeContext';

import css from './Transition.less';

const forwardTransitionEnd = forward('onTransitionEnd');
const forwardOnShow = forward('onShow');
const forwardOnHide = forward('onHide');

/**
 * The stateless structure of the component, in case you want to provide all of the state yourself.
 * In general, you'll probably want to use the [stateful version]{@link ui/Transition.Transition}.
 *
 * @class TransitionBase
 * @memberof ui/Transition
 * @public
 */
const TransitionBase = kind({
	name: 'TransitionBase',

	propTypes: /** @lends ui/Transition.TransitionBase.prototype */ {
		/**
		 * Provide a function to get the reference to the child node (the one with the content) at
		 * render time. Useful if you need to measure or interact with the node directly.
		 *
		 * @type {Function}
		 * @default null
		 * @public
		 */
		childRef: PropTypes.func,

		/**
		 * The node to be transitioned.
		 *
		 * @type {Node}
		 * @public
		 */
		children: PropTypes.node,

		/**
		 * The height of the transition when `type` is set to `'clip'`, used when direction is
		 * 'left' or 'right'.
		 *
		 * @type {Number}
		 * @default null
		 * @public
		 */
		clipHeight: PropTypes.number,

		/**
		 * The width of the transition when `type` is set to `'clip'`, used when direction is 'left'
		 * or 'right'.
		 *
		 * @type {Number}
		 * @default null
		 * @public
		 */
		clipWidth: PropTypes.number,

		/**
		 * Sets the direction of transition. Where the component will move *to*; the destination.
		 * Supported directions are: `'up'`, `'right'`, `'down'`, `'left'`.
		 *
		 * @type {String}
		 * @default 'up'
		 * @public
		 */
		direction: PropTypes.oneOf(['up', 'right', 'down', 'left']),

		/**
		 * Control how long the transition should take.
		 * Supported preset durations are: `'short'` (250ms), `'medium'` (500ms), and `'long'` (1s).
		 * `'medium'` (500ms) is default when no others are specified.
		 * Any valid CSS duration value is also accepted, e.g. "200ms" or "3s". Pure numeric values
		 * are also supported and treated as miliseconds.
		 *
		 * @type {String|Number}
		 * @default 'medium'
		 * @public
		 */
		duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

		/**
		 * When `true`, transition animation is disabled. When `false`, visibility changes animate.
		 *
		 * @type {Boolean}
		 * @default false
		 * @public
		 */
		noAnimation: PropTypes.bool,

		/**
		 * Customize the transition timing function.
		 * Supported function names are: `ease`, `ease-in`, `ease-out`, `ease-in-out`, `ease-in-quart`,
		 * `ease-out-quart`, and `linear`.
		 *
		 * @type {String}
		 * @default 'ease-in-out'
		 * @public
		 */
		timingFunction: PropTypes.oneOf([
			'ease',
			'ease-in',
			'ease-out',
			'ease-in-out',
			'ease-in-quart',
			'ease-out-quart',
			'linear'
		]),

		/**
		 * How you'd like the transition to affect the content.
		 * Supported types are: `'slide'`, `'clip'`, and `'fade'`.
		 *
		 * Details on types:
		 *  * `'slide'` - Typically used for bringing something which is off the edge of the screen,
		 *  	and not visible, onto the screen. Think of a popup, toast, notification, dialog, or
		 *  	an overlaying menu. This requires no re-rendering or repainting of the screen during
		 *  	the transition, making it very performant. However, this does not affect layout at
		 *  	all, which makes it less useful for transitioning from a place already on the
		 *  	screen.
		 *  * `'clip'` - This is useful for showing a component that transitions-in from a location
		 *  	that is already on the screen. Examples would be an expanding header or an
		 *  	accordion. This type does affects layout, its current size will push other sibling
		 *  	elements to make room for itself. Because of this, repainting the layout does happen
		 *  	during transition.
		 *  * `'fade'` - Fade the components onto the screen, from 0 opacity (completely invisible)
		 *  	to 1 (full visibility). Pretty basic, but useful for fading on/off a tooltip, a
		 *  	menu, a panel, or even view contents. This does not affect layout at all.
		 *
		 * @type {String}
		 * @default 'slide'
		 * @public
		 */
		type: PropTypes.oneOf(['slide', 'clip', 'fade']),

		/**
		 * Set the visibility of the component, which determines whether it's on screen or off.
		 *
		 * @type {Boolean}
		 * @default true
		 * @public
		 */
		visible: PropTypes.bool
	},

	defaultProps: {
		noAnimation: false,
		direction: 'up',
		duration: 'medium',
		timingFunction: 'ease-in-out',
		type: 'slide',
		visible: true
	},

	styles: {
		css,
		className: 'transition'
	},

	computed: {
		className: ({direction, duration, timingFunction, type, visible, styler}) => styler.append(
			visible ? 'shown' : 'hidden',
			direction && css[direction],
			duration && css[duration],
			timingFunction && css[timingFunction],
			css[type]
		),
		innerStyle: ({clipWidth, direction, type}) => {
			if (type === 'clip' && (direction === 'left' || direction === 'right')) {
				return {
					width: clipWidth
				};
			}
		},
		style: ({clipHeight, direction, duration, type, visible, style}) => {
			if (type === 'clip') {
				style = {
					...style,
					overflow: 'hidden'
				};

				if (visible && (direction === 'up' || direction === 'down')) {
					style.height = clipHeight;
				}
				// If duration isn't a known named string, assume it is a CSS duration value
				if (duration && !css[duration]) {
					// If it's a number, assume it's miliseconds, if not, assume it's already a CSS duration string (like "200ms" or "2s")
					style.transitionDuration = (typeof duration === 'number' ? duration + 'ms' : duration);
				}
			}

			return style;
		},
		childRef: ({childRef, noAnimation, children}) => (noAnimation || !children) ? null : childRef
	},

	render: ({childRef, children, innerStyle, noAnimation, visible, ...rest}) => {
		delete rest.clipHeight;
		delete rest.clipWidth;
		delete rest.direction;
		delete rest.duration;
		delete rest.timingFunction;
		delete rest.type;

		if (noAnimation && !visible) {
			return null;
		}

		return (
			<div {...rest}>
				<div className={css.inner} style={innerStyle} ref={childRef}>
					{children}
				</div>
			</div>
		);
	}
});

const TRANSITION_STATE = {
	INIT: 0,		// closed and unmeasured
	MEASURE: 1,		// open but need to measure
	READY: 2		// measured and ready
};

const TransitionDecorator = hoc((config, Wrapped) => {
	/**
	 * A stateful component that allows for applying transitions to its child items via configurable
	 * properties and events.
	 *
	 * @class Transition
	 * @memberof ui/Transition
	 * @public
	 */
	return class extends React.Component {
		static displayName = 'TransitionDecorator'

		static propTypes = /** @lends ui/Transition.Transition.prototype */ {
			/**
			 * The node to be transitioned.
			 *
			 * @type {Node}
			 * @public
			 */
			children: PropTypes.node,

			/**
			 * The direction of transition (i.e. where the component will move *to*; the destination).
			 * Supported directions are: `'up'`, `'right'`, `'down'`, `'left'`.
			 *
			 * @type {String}
			 * @default 'up'
			 * @public
			 */
			direction: PropTypes.oneOf(['up', 'right', 'down', 'left']),

			/**
			 * Control how long the transition should take.
			 * Supported preset durations are: `'short'` (250ms), `'medium'` (500ms), and `'long'` (1s).
			 * `'medium'` (500ms) is default when no others are specified.
			 * Any valid CSS duration value is also accepted, e.g. "200ms" or "3s". Pure numeric values
			 * are also supported and treated as miliseconds.
			 *
			 * @type {String|Number}
			 * @default 'medium'
			 * @public
			 */
			duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

			/**
			 * A function to run after transition for hiding is finished.
			 *
			 * @type {Function}
			 * @public
			 */
			onHide: PropTypes.func,

			/**
			 * A function to run after transition for showing is finished.
			 *
			 * @type {Function}
			 * @public
			 */
			onShow: PropTypes.func,

			/**
			 * Informs the compoennt that its contents have changed requiring its bounds be
			 * recalculated.
			 *
			 * @type {Boolean}
			 * @private
			 */
			resize: PropTypes.bool,

			/**
			 * Customize the transition timing function.
			 * Supported function names are: `ease`, `ease-in`, `ease-out`, `ease-in-out`, `ease-in-quart`,
			 * `ease-out-quart`, and `linear`.
			 *
			 * @type {String}
			 * @default 'ease-in-out'
			 * @public
			 */
			timingFunction: PropTypes.oneOf([
				'ease',
				'ease-in',
				'ease-out',
				'ease-in-out',
				'ease-in-quart',
				'ease-out-quart',
				'linear'
			]),

			/**
			 * How you'd like the transition to affect the content.
			 * Supported types are: `'slide'`, `'clip'`, and `'fade'`.
			 *
			 * Details on types:
			 *  * `'slide'` - Typically used for bringing something which is off the edge of the screen,
			 *  	and not visible, onto the screen. Think of a popup, toast, notification, dialog, or
			 *  	an overlaying menu. This requires no re-rendering or repainting of the screen during
			 *  	the transition, making it very performant. However, this does not affect layout at
			 *  	all, which makes it less useful for transitioning from a place already on the
			 *  	screen.
			 *  * `'clip'` - This is useful for showing a component that transitions-in from a location
			 *  	that is already on the screen. Examples would be an expanding header or an
			 *  	accordion. This type does affects layout, its current size will push other sibling
			 *  	elements to make room for itself. Because of this, repainting the layout does happen
			 *  	during transition.
			 *  * `'fade'` - Fade the components onto the screen, from 0 opacity (completely invisible)
			 *  	to 1 (full visibility). Pretty basic, but useful for fading on/off a tooltip, a
			 *  	menu, a panel, or even view contents. This does not affect layout at all.
			 *
			 * @type {String}
			 * @default 'slide'
			 * @public
			 */
			type: PropTypes.oneOf(['slide', 'clip', 'fade']),

			/**
			 * The visibility of the component, which determines whether it's on the screen or off.
			 *
			 * @type {Boolean}
			 * @default true
			 * @public
			 */
			visible: PropTypes.bool
		}

		static defaultProps = {
			direction: 'up',
			duration: 'medium',
			timingFunction: 'ease-in-out',
			type: 'slide',
			visible: true
		}

		constructor (props) {
			super(props);

			this.state = {
				initialHeight: null,
				renderState: props.visible ? TRANSITION_STATE.READY : TRANSITION_STATE.INIT
			};
		}

		componentDidMount () {
			if (!this.props.visible) {
				this.measuringJob.idle();
			} else {
				this.measureInner();
			}
		}

		componentWillReceiveProps (nextProps) {
			if (nextProps.visible && this.state.renderState === TRANSITION_STATE.INIT) {
				this.setState({
					renderState: TRANSITION_STATE.MEASURE
				});
			}

			if (nextProps.resize && this.props.resize !== nextProps.resize) {
				this.measureInner();
			}
		}

		shouldComponentUpdate (nextProps, nextState) {
			// Don't update if only updating the height and we're not visible
			return (this.state.initialHeight === nextState.initialHeight) || this.props.visible || nextProps.visible;
		}

		componentWillUpdate (nextProps, nextState) {
			if (nextState.renderState === TRANSITION_STATE.MEASURE) {
				this.measuringJob.stop();
			}
		}

		componentDidUpdate (prevProps, prevState) {
			const {visible} = this.props;
			const {initialHeight, renderState} = this.state;

			// Checking that something changed that wasn't the visibility
			// or the initialHeight state or checking if component should be visible but doesn't have a height
			if ((visible === prevProps.visible &&
				initialHeight === prevState.initialHeight &&
				renderState !== TRANSITION_STATE.INIT) ||
				(initialHeight == null && visible)) {
				this.measureInner();
			}

			if (!this.childNode) {
				if (!prevProps.visible && visible) {
					forwardOnShow({}, this.props);
				} else if (prevProps.visible && !visible) {
					forwardOnHide({}, this.props);
				}
			}
		}

		componentWillUnmount () {
			this.measuringJob.stop();
		}

		measuringJob = new Job(() => {
			this.setState({
				renderState: TRANSITION_STATE.MEASURE
			});
		})

		handleTransitionEnd = (ev) => {
			forwardTransitionEnd(ev, this.props);

			if (ev.target === this.childNode) {
				if (!this.props.visible && this.props.onHide) {
					this.props.onHide(ev);
				} else if (this.props.visible && this.props.onShow) {
					this.props.onShow(ev);
				}
			}
		}

		measureInner = () => {
			if (this.childNode) {
				const initialHeight = this.childNode.scrollHeight;
				const initialWidth = this.childNode.scrollWidth;
				if (initialHeight !== this.state.initialHeight || initialWidth !== this.state.initialWidth) {
					this.setState({
						initialHeight,
						initialWidth,
						renderState: TRANSITION_STATE.READY
					});
				}
			}
		}

		childRef = (node) => {
			this.childNode = node;
		}

		render () {
			const {visible, ...props} = this.props;
			delete props.onHide;
			delete props.onShow;
			delete props.resize;

			switch (this.state.renderState) {
				// If we are deferring children, don't render any
				case TRANSITION_STATE.INIT: return null;

				// If we're transitioning to visible but don't have a measurement yet, create the
				// transition container with its children so we can measure. Measuring will cause a
				// state change to trigger the animation.
				case TRANSITION_STATE.MEASURE: return (
					<Wrapped {...props} childRef={this.childRef} visible={false} />
				);

				case TRANSITION_STATE.READY: return (
					<Wrapped
						{...props}
						childRef={this.childRef}
						visible={visible}
						clipHeight={this.state.initialHeight}
						clipWidth={this.state.initialWidth}
						onTransitionEnd={this.handleTransitionEnd}
					/>
				);
			}
		}
	};
});

const Transition = ResizeContentConsumerDecorator(
	{prop: 'resize'},
	TransitionDecorator(
		TransitionBase
	)
);

export default Transition;
export {
	Transition,
	TransitionBase
};
