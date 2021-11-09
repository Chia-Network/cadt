import React from 'react';
import { CircularProgress } from '@mui/material';
import styled from 'styled-components';

const Container = styled('div')`
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: rgba(0, 0, 0, 0.25);
  display: flex;
  justify-content: center;
  align-items: center;
`;

const IndeterminateProgressOverlay = () => (
  <div className="progess">
    <Container>
      <CircularProgress size={80} thickness={5} />
    </Container>
  </div>
);

export { IndeterminateProgressOverlay };
