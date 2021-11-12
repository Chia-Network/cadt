import React from 'react';
import styled, { withTheme } from 'styled-components';
import { useSelector } from 'react-redux';

const CardContainer = styled('div')`
  background-color: ${props => props.theme.colors[props.selectedTheme].surface};
  box-shadow: ${props => props.theme.colors[props.selectedTheme].surfaceShadow};
  border-radius: 0.25rem;
  padding: 1rem;
  margin: 0.75rem;
  max-height: ${props => props.maxHeight};
  overflow: auto;
  overflow-x: hidden;
`;

const Card = withTheme(({ children, maxHeight = '100%' }) => {
  const appStore = useSelector(state => state.app);

  return (
    <CardContainer selectedTheme={appStore.theme} maxHeight={maxHeight}>
      {children}
    </CardContainer>
  );
});

export { Card };
