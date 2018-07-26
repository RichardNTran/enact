/**
 * Provides unstyled LabeledIconButton components to be customized by a theme or application.
 *
 * @module ui/LabeledIconButton
 * @exports LabeledIconButton
 */

import kind from '@enact/core/kind';
import PropTypes from 'prop-types';
import compose from 'ramda/src/compose';
import Spottable from '@enact/spotlight/Spottable';
import Pure from '@enact/ui/internal/Pure';
import UiLabeledIcon from '@enact/ui/LabeledIcon';
import {IconButtonDecorator as UiIconButtonDecorator} from '@enact/ui/IconButton';

import {IconButtonBase} from '../IconButton';
import Skinnable from '../Skinnable';

// This refers to the LabeledIcon styling, since they're the same.
// If this fact changes in the future, we can simply create a new less file in this component and
// either copy or less-import the styling rules from LabeledIcon. (Whichever is more appropriate.)
import componentCss from '../LabeledIcon/LabeledIcon.less';

const IconButton = compose(
	UiIconButtonDecorator,
	Spottable,
	Skinnable
)(IconButtonBase);

/**
 * A basic LabeledIconButton component structure without any behaviors applied to it.
 *
 * @class LabeledIconButtonBase
 * @memberof ui/LabeledIconButton
 * @ui
 * @public
 */
const LabeledIconButtonBase = kind({
	name: 'LabeledIconButton',

	propTypes: /** @lends ui/LabeledIconButton.LabeledIconButtonBase.prototype */ {
		/**
		 * The readable label. This accepts strings, DOM, and Components, if you need more elaborate
		 * features.
		 *
		 * @type {Node}
		 * @public
		 */
		children: PropTypes.node,

		/**
		 * Customizes the component by mapping the supplied collection of CSS class names to the
		 * corresponding internal Elements and states of this component.
		 *
		 * The following classes are supported:
		 *
		 * * `labeledIconButton` - The root component class
		 * * `label` - The label component class
		 * * `icon` - The icon component class
		 *
		 * @type {Object}
		 * @public
		 */
		css: PropTypes.object
	},

	styles: {
		css: componentCss,
		className: 'labeledIconButton',
		publicClassNames: ['labeledIconButton', 'icon', 'label']
	},

	render: ({css, children, ...rest}) => {
		return UiLabeledIcon.inline({
			iconComponent: IconButton,
			...rest,
			css,
			children
		});
	}
});

const LabeledIconButtonDecorator = compose(
	Pure,
	Skinnable
);

const LabeledIconButton = LabeledIconButtonDecorator(LabeledIconButtonBase);

export default LabeledIconButton;
export {
	LabeledIconButton,
	LabeledIconButtonBase,
	LabeledIconButtonDecorator
};