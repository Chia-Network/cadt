import React from 'react';
import styled from 'styled-components';

const Container = styled('div')`
  height: ${props => props.size}px;
  width: 100%;
`;

const VerticalSpacer = ({children, size}) => (
  <Container size={size}>{children}</Container>
);

export {VerticalSpacer};
