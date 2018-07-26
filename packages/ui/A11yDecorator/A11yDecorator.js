/**
 * Exports the {@link ui/A11yDecorator.A11yDecorator} Higher-order Component (HOC).
 *
 * @module ui/A11yDecorator
 */

import hoc from '@enact/core/hoc';
import kind from '@enact/core/kind';
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Default config for {@link ui/A11yDecorator.A11yDecorator}.
 *
 * @memberof ui/A11yDecorator.A11yDecorator
 * @hocconfig
 */
const defaultConfig = {
	/**
	 * Configures the prop for the source of the component's content
	 *
	 * @type {String}
	 * @default 'children'
	 * @memberof ui/A11yDecorator.A11yDecorator.defaultConfig
	 */
	prop: 'children'
};

/**
 * A Higher-order Component that adds support for hint text to be read before and/or after the
 * content. By default, the `children` prop is used as the source of the components content but
 * may be configured by passing a different `prop` to the HOC configuration.
 *
 * @class A11yDecorator
 * @memberof ui/A11yDecorator
 * @hoc
 * @public
 */
const A11yDecorator = hoc(defaultConfig, (config, Wrapped) => {
	const {prop} = config;

	return kind({
		name: 'A11yDecorator',

		propTypes: {
			accessibilityHint: PropTypes.string,
			accessibilityPreHint: PropTypes.string,
			// TOOD: fix bug in react eslint rules with sorting of quoted keys
			// eslint-disable-next-line react/sort-prop-types
			'aria-label': PropTypes.string
		},

		computed: {
			'aria-label': ({'aria-label': aria, accessibilityPreHint: prehint, accessibilityHint: hint, [prop]: content}) => {
				if (!aria) {
					const
						prefix = content || null,
						label = prehint && prefix && hint && (prehint + ' ' + prefix + ' ' + hint) ||
							prehint && prefix && (prehint + ' ' + prefix) ||
							prehint && hint && (prehint + ' ' + hint) ||
							hint && prefix && (prefix + ' ' + hint) ||
							prehint ||
							hint ||
							null;
					return label;
				}
				return aria;
			}
		},

		render: (props) => {
			delete props.accessibilityPreHint;
			delete props.accessibilityHint;

			return (
				<Wrapped {...props} />
			);
		}
	});
});

export default A11yDecorator;
export {A11yDecorator};
