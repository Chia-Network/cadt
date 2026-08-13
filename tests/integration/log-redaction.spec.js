import { expect } from 'chai';
import supertest from 'supertest';
import { Writable } from 'stream';
import winston from 'winston';
import { redactHeaders, REDACTED } from '../../src/utils/log-redaction.js';
import { logger } from '../../src/config/logger.js';
import app from '../../src/server';

const API_KEY = 'super-secret-api-key-value';

const attachCapture = (sink) => {
  const stream = new Writable({
    write(chunk, encoding, callback) {
      sink.push(chunk.toString());
      callback();
    },
  });

  const transport = new winston.transports.Stream({
    stream,
    level: 'silly',
    format: winston.format.json(),
  });

  logger.add(transport);
  return transport;
};

describe('redactHeaders', function () {
  it('replaces the x-api-key value', function () {
    const redacted = redactHeaders({ 'x-api-key': API_KEY });
    expect(redacted['x-api-key']).to.equal(REDACTED);
  });

  it('matches header names case-insensitively', function () {
    const redacted = redactHeaders({
      'X-Api-Key': API_KEY,
      Authorization: 'Bearer t',
    });
    expect(redacted['X-Api-Key']).to.equal(REDACTED);
    expect(redacted.Authorization).to.equal(REDACTED);
  });

  it('preserves non-sensitive headers', function () {
    const redacted = redactHeaders({
      'content-type': 'application/json',
      'user-agent': 'curl/8.0.0',
    });
    expect(redacted['content-type']).to.equal('application/json');
    expect(redacted['user-agent']).to.equal('curl/8.0.0');
  });

  it('does not mutate the source header map', function () {
    const headers = { 'x-api-key': API_KEY };
    redactHeaders(headers);
    expect(headers['x-api-key']).to.equal(API_KEY);
  });

  it('passes through non-object input', function () {
    expect(redactHeaders(undefined)).to.equal(undefined);
    expect(redactHeaders(null)).to.equal(null);
  });
});

describe('logger credential redaction', function () {
  let captured;
  let captureTransport;

  beforeEach(function () {
    captured = [];
    captureTransport = attachCapture(captured);
  });

  afterEach(function () {
    logger.remove(captureTransport);
  });

  // The transports in src/config/logger.js are pinned to 'debug', so verbose
  // records reach the log stream regardless of APP.LOG_LEVEL.
  it('keeps an api key out of a verbose record carrying headers', function () {
    logger.verbose('Received request: GET /v1/projects', {
      method: 'GET',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
    });

    const output = captured.join('\n');
    expect(output).to.not.include(API_KEY);
    expect(output).to.include(REDACTED);
    expect(output).to.include('application/json');
  });

  it('keeps an api key out of records at other levels', function () {
    const levels = ['error', 'warn', 'info', 'debug', 'silly'];
    for (const level of levels) {
      logger[level]('request detail', { headers: { 'x-api-key': API_KEY } });
    }

    expect(captured).to.have.lengthOf(levels.length);
    expect(captured.join('\n')).to.not.include(API_KEY);
  });

  it('redacts a caller-supplied metadata object without mutating it', function () {
    const callerMetadata = { headers: { 'x-api-key': API_KEY } };
    logger.info('nested metadata', { metadata: callerMetadata });

    expect(captured.join('\n')).to.not.include(API_KEY);
    expect(callerMetadata.headers['x-api-key']).to.equal(API_KEY);
  });
});

// Records the metadata passed to logger.verbose. Returns an undo function;
// winston defines the level methods on the logger's prototype, so the patch is
// removed by deleting the shadowing own property rather than reassigning.
const recordVerboseCalls = (sink) => {
  const hadOwnProperty = Object.hasOwn(logger, 'verbose');
  const original = logger.verbose;

  logger.verbose = function (...args) {
    sink.push(args[1]);
    return original.apply(this, args);
  };

  return () => {
    if (hadOwnProperty) {
      logger.verbose = original;
    } else {
      delete logger.verbose;
    }
  };
};

describe('request logger', function () {
  let captured;
  let captureTransport;
  let restoreVerbose;

  beforeEach(function () {
    captured = [];
    captureTransport = attachCapture(captured);
    restoreVerbose = null;
  });

  // Restores in a hook rather than the test body so a timeout, which abandons
  // the test without running its remaining statements, cannot leave the patched
  // method installed for sibling tests.
  afterEach(function () {
    logger.remove(captureTransport);
    if (restoreVerbose) {
      restoreVerbose();
    }
  });

  it('does not log the x-api-key sent with a request', async function () {
    await supertest(app).get('/health').set('x-api-key', API_KEY);

    const output = captured.join('\n');
    expect(output).to.include('Received request: GET /health');
    expect(output).to.not.include(API_KEY);
    expect(output).to.include(REDACTED);
  });

  // Asserted against the record handed to the logger rather than the emitted
  // output, so this covers the call site on its own: the logger's redaction
  // format would otherwise scrub the key even if the middleware passed it in.
  it('hands the logger a record that is already redacted', async function () {
    const records = [];
    restoreVerbose = recordVerboseCalls(records);

    await supertest(app).get('/health').set('x-api-key', API_KEY);

    const requestRecord = records.find((meta) => meta?.headers);
    expect(requestRecord, 'no request record with headers was logged').to.exist;
    expect(requestRecord.headers['x-api-key']).to.equal(REDACTED);
  });
});
