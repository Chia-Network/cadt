import React from 'react';
import styled, { withTheme } from 'styled-components';

const Line = styled('div')`
  border-color: ${props => props.theme.colors.hr};
  border-right-width: 0.0625rem;
  width: 0.0625rem;
  margin: 0.125rem;
`;

const VerticalRule = withTheme(({ size }) => <Line style={{ height: size }} />);
export { VerticalRule };
