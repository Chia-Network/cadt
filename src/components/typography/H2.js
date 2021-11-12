import React from 'react';
import {useSelector} from 'react-redux';
import styled, {withTheme} from 'styled-components';

const Text = withTheme(styled('h1')`
  color: ${props =>
    props.color || props.theme.colors[props.selectedTheme].onSurface};
  font-size: 1.25rem;
  font-family: ${props => props.theme.typography.primary};
  font-weight: 400;
  line-height: 1.334;
  letter-spacing: 0em;
`);

const H2 = withTheme(({children, color}) => {
  const appStore = useSelector(state => state.app);
  return (
    <Text color={color} selectedTheme={appStore.theme}>
      {children}
    </Text>
  );
});

export {H2};
