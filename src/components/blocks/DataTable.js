import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import styled, { withTheme } from 'styled-components';
import ReactPaginate from 'react-paginate';

import constants from '../../constants';

const Table = styled('table')`
  width: 100%;
  display: table;
  border-spacing: 0;
  border-collapse: collapse;
  box-shadow: ${props => props.theme.colors[props.selectedTheme].surfaceShadow};
`;

const THead = styled('thead')`
  font-weight: 500;
  background-color: ${props =>
    props.theme.colors[props.selectedTheme].onSurfaceSecondaryVarient};
`;

const Th = styled('th')`
  padding: 1rem;
  font-size: 0.875rem;
  color: ${props => props.theme.colors[props.selectedTheme].onSurface};
  display: table-cell;
  text-align: left;
  font-family: ${props => props.theme.typography.primary};
  font-weight: 400;
  line-height: 1.43;
  border-bottom: ${props =>
    props.selectedTheme === constants.THEME.DARK
      ? '1px solid rgba(81, 81, 81, 1)'
      : '1px solid rgba(224, 224, 224, 1)'};

  letter-spacing: 0.01071em;
  vertical-align: inherit;

  ${props =>
    props.start &&
    `
  border-top-left-radius: 0.25rem;
  `}

  ${props =>
    props.end &&
    `
  border-top-right-radius: 0.25rem;
  `}
`;

const Tr = styled('tr')`
  color: ${props => props.theme.colors[props.selectedTheme].onSurface};
  background-color: ${props => props.theme.colors[props.selectedTheme].surface};

  ${props =>
    props.index % 2 !== 0 &&
    `
  background-color: ${
    props.theme.colors[props.selectedTheme].onSurfacePrimaryVarient
  };
  `}
`;

const Td = styled('td')`
  display: table-cell;
  padding: 1rem;
  font-size: 0.875rem;
  text-align: left;
  font-family: ${props => props.theme.typography.primary};
  font-weight: 400;
  line-height: 1.43;
  border-bottom: 1px solid
    ${props =>
      props.selectedTheme === constants.THEME.DARK
        ? 'rgba(81, 81, 81, 1)'
        : 'rgba(224, 224, 224, 1)'};
  letter-spacing: 0.01071em;
  vertical-align: inherit;
`;

// React ReactPaginate cant be directly modified by styled-components
// so we create a wrapper that can select the sub classes within the component
const StyledPaginateContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  .pagination {
    padding: 0;
    color: ${props => props.theme.colors[props.selectedTheme].onSurface};
    list-style-type: none;
    display: flex;
  }
  .break-me {
    cursor: default;
  }
  .active {
    border-color: transparent;
    background-color: ${props =>
      props.selectedTheme === constants.THEME.DARK
        ? props.theme.colors[props.selectedTheme].onSurfacePrimaryVarient
        : props.theme.colors[props.selectedTheme].onSurfaceSecondaryVarient};

    color: ${props => props.theme.colors[props.selectedTheme].onSurface};
    border-radius: 0.25rem;
  }
  li {
    cursor: pointer;
    width: 1.5625rem;
    height: 1.5625rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;

const DataTable = withTheme(({ headings, data }) => {
  const [currentPage, setPage] = useState(0);
  const appStore = useSelector(state => state.app);

  const handlePageClick = event => {
    setPage(event.selected);
  };

  if (currentPage > data.length) {
    setPage(0);
    return null;
  }

  if (!data[currentPage]) {
    return null;
  }

  return (
    <>
      <StyledPaginateContainer selectedTheme={appStore.theme}>
        <ReactPaginate
          breakLabel="..."
          nextLabel=">"
          onPageChange={handlePageClick}
          forcePage={currentPage}
          pageRangeDisplayed={5}
          pageCount={(data && data.length) || 0}
          previousLabel="<"
          renderOnZeroPageCount={null}
          containerClassName="pagination"
          activeClassName="active"
          breakClassName="break-me"
        />
      </StyledPaginateContainer>
      <Table selectedTheme={appStore.theme}>
        <THead selectedTheme={appStore.theme}>
          <tr>
            {headings.map((heading, index) => (
              <Th
                start={index === 0}
                end={index === headings.length - 1}
                selectedTheme={appStore.theme}
                key={index}>
                {heading}
              </Th>
            ))}
          </tr>
        </THead>
        <tbody>
          {data[currentPage].map((record, index) => (
            <Tr index={index} selectedTheme={appStore.theme} key={index}>
              {Object.keys(record).map((key, index) => (
                <Td selectedTheme={appStore.theme} key={index}>
                  {record[key]}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </>
  );
});

export { DataTable };
