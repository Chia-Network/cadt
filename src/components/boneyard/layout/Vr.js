import React from 'react';
import styled, {withTheme} from 'styled-components';

const Line = styled('div')`
  border-color: ${props => props.theme.colors.hr};
  border-right-width: 1px;
  width: 1px;
  margin: 2px;
`;

const VerticalRule = withTheme(({size}) => <Line style={{height: size}} />);
export {VerticalRule};
