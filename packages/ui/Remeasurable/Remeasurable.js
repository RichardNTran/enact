/**
 * Exports the {@link ui/Remeasurable.Remeasurable} and {@link ui/Remeasurable.RemeasurableDecorator}
 * Higher-order Component (HOC). Adds the ability to broadcast remeasure changes
 * based on a callback. The default export is {@link ui/Remeasurable.Remeasurable}.
 *
 * @module ui/Remeasurable
 * @private
 */
import React from 'react';
import invariant from 'invariant';
import hoc from '@enact/core/hoc';
import {perfNow} from '@enact/core/util';

const ResizeContext = React.createContext();

/**
 * Default config for {@link ui/Remeasurable.RemeasurableDecorator}
 *
 * @memberof ui/Remeasurable.RemeasurableDecorator
 * @hocconfig
 */
const defaultConfig = {
	/**
	 * Configures the event name that triggers the component
	 *
	 * @type {String}
	 * @memberof ui/Remeasurable.RemeasurableDecorator.defaultConfig
	 */
	trigger: null
};

/**
 * {@link ui/Remeasurable.RemeasurableDecorator} is a Higher-order Component which adds the ability
 * to broadcast remeasure changes based on a callback.
 *
 * @class RemeasurableDecorator
 * @memberof ui/Remeasurable
 * @hoc
 * @private
 */
const RemeasurableDecorator = hoc(defaultConfig, (config, Wrapped) => {
	const {trigger} = config;

	invariant(trigger, 'trigger is required by RemeasurableDecorator');

	return class extends React.Component {
		static displayName = 'RemeasurableDecorator'

		constructor (props) {
			super(props);
			this.state = {
				remeasure: null
			};
		}

		componentWillReceiveProps (nextProps) {
			if (this.props[trigger] !== nextProps[trigger]) {
				this.setState({
					remeasure: perfNow()
				});
			}
		}

		render () {
			return (
				<ResizeContext.Provider value={this.state.remeasure}>
					<Wrapped {...this.props} />
				</ResizeContext.Provider>
			);
		}
	};
});

/**
 * {@link ui/Remeasurable.Remeasurable} is a Higher-order Component which notifies a child of a
 * change in size from parent. This can then be used to trigger a new measurement. A `remeasure`
 * prop will be passed down to the wrapped component.
 *
 * @class Remeasurable
 * @memberof ui/Remeasurable
 * @hoc
 * @private
 */
const Remeasurable = hoc((config, Wrapped) => {
	// eslint-disable-next-line no-shadow
	return function Remeasurable (props) {
		return (
			<ResizeContext.Consumer>
				{remeasure => (
					<Wrapped {...props} remeasure={remeasure} />
				)}
			</ResizeContext.Consumer>
		);
	};
});

export default Remeasurable;
export {
	Remeasurable,
	RemeasurableDecorator
};
