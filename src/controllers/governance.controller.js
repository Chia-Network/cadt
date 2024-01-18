import _ from 'lodash';

import { Governance, Meta } from '../models';

import {
  assertIsActiveGovernanceBody,
  assertIfReadOnlyMode,
  assertWalletIsSynced,
  assertCanBeGovernanceBody,
} from '../utils/data-assertions';

import { CONFIG } from '../user-config';
import glossary from '../models/governance/glossary.stub.js';
import pickList from '../models/governance/governance.stub.js';

export const findAll = async (req, res) => {
  try {
    const results = await Governance.findAll();
    return res.json(results);
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
      success: false,
    });
  }
};

export const isCreated = async (req, res) => {
  try {
    const results = await Meta.findOne({
      where: { metaKey: 'governanceBodyId' },
    });

    if (results) {
      return res.json({
        created: true,
        success: true,
      });
    } else {
      return res.json({
        created: false,
        success: true,
      });
    }
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
      success: false,
    });
  }
};

export const findOrgList = async (req, res) => {
  try {
    const results = await Governance.findOne({ where: { metaKey: 'orgList' } });
    return res.json(JSON.parse(_.get(results, 'metaValue', {})));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
      success: false,
    });
  }
};

export const findGlossary = async (req, res) => {
  try {
    if (CONFIG().CADT.USE_DEVELOPMENT_MODE) {
      return res.json(glossary);
    }

    const results = await Governance.findOne({
      where: { metaKey: 'glossary' },
    });
    return res.json(JSON.parse(_.get(results, 'metaValue', {})));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
      success: false,
    });
  }
};

export const findPickList = async (req, res) => {
  try {
    if (CONFIG().CADT.USE_DEVELOPMENT_MODE) {
      return res.json(pickList);
    }

    const results = await Governance.findOne({
      where: { metaKey: 'pickList' },
    });

    return res.json(JSON.parse(_.get(results, 'metaValue', {})));
  } catch (error) {
    res.status(400).json({
      message: 'Can not retreive Governance Data',
      error: error.message,
      success: false,
    });
  }
};

export const renderGovernance = async (req, res) => {
  let govPickList;
  if (CONFIG().CADT.USE_DEVELOPMENT_MODE) {
    govPickList = pickList;
  }

  govPickList = await Governance.findOne({
    where: { metaKey: 'pickList' },
    raw: true,
  });

  const parsedPickList = JSON.parse(govPickList.metaValue);

  let htmlContent = `
  <html>
  <head>
    <title>Pick List</title>
    <script>
      function copyToClipboard(text) {
        const elem = document.createElement('textarea');
        elem.value = text;
        document.body.appendChild(elem);
        elem.select();
        document.execCommand('copy');
        document.body.removeChild(elem);
        alert('"' + text + '" copied to clipboard');
      }
    </script>
  </head>
  <body style="padding: 15px">

  <!-- Table of Contents section -->
  <h2>Table of Contents</h2>
  <div id="navigation"><ul>`;

  for (const key in parsedPickList) {
    htmlContent += `<li><a href="#${key}">${key}</a></li>`;
  }

  htmlContent += `</ul></div>

  <!-- List section -->
  `;

  for (const key in parsedPickList) {
    htmlContent += `<h2 id="${key}">${key} <a href="#${key}" style="text-decoration:none;">[#]</a></h2><ol>`;
    for (const item of parsedPickList[key]) {
      htmlContent += `<li style="cursor: pointer;" onclick="copyToClipboard('${item.replace(
        /'/g,
        "\\'",
      )}')">${item}</li>`;
    }
    htmlContent += '</ol>';
  }

  htmlContent += '</body></html>';

  res.setHeader('Content-Type', 'text/html');
  res.send(htmlContent);
};

// eslint-disable-next-line
export const createGoveranceBody = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertCanBeGovernanceBody();

    Governance.createGoveranceBody();

    return res.json({
      message:
        'Setting up new Governance Body on this node, this can take a few mins',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant create Governance Body',
      error: error.message,
      success: false,
    });
  }
};

// eslint-disable-next-line
export const setDefaultOrgList = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertIsActiveGovernanceBody();

    const orgList = JSON.stringify(req.body);

    await Governance.updateGoveranceBodyData([
      { key: 'orgList', value: orgList },
    ]);

    return res.json({
      message: 'Committed this new organization list to the datalayer',
      success: true,
    });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Cant update default orgs',
      error: error.message,
      success: false,
    });
  }
};

// eslint-disable-next-line
export const setPickList = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertIsActiveGovernanceBody();

    const pickList = JSON.stringify(req.body);

    await Governance.updateGoveranceBodyData([
      { key: 'pickList', value: pickList },
    ]);

    return res.json({
      message: 'Committed this pick list to the datalayer',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant update picklist',
      error: error.message,
      success: false,
    });
  }
};

export const setGlossary = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertWalletIsSynced();
    await assertIsActiveGovernanceBody();

    const glossary = JSON.stringify(req.body);

    await Governance.updateGoveranceBodyData([
      { key: 'glossary', value: glossary },
    ]);

    return res.json({
      message: 'Committed glossary to the datalayer',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant update glossary',
      error: error.message,
      success: false,
    });
  }
};

export const sync = async (req, res) => {
  try {
    Governance.sync();
    return res.json({
      message: 'Syncing Governance Body',
      success: true,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Cant Sync Governance Body',
      error: error.message,
      success: false,
    });
  }
};
