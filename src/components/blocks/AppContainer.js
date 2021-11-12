import React from 'react';
import {useSelector} from 'react-redux';
import styled, {withTheme} from 'styled-components';

const Div = styled('div')`
  background: ${props => props.theme.colors[props.selectedTheme].background};
  width: 100%;
  height: 100%;
`;

const AppContainer = withTheme(({children}) => {
  const appStore = useSelector(state => state.app);
  return <Div selectedTheme={appStore.theme}>{children}</Div>;
});

export {AppContainer};
