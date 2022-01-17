import chai from 'chai';
import chaiHttp from 'chai-http';
import app from './../../src/server';

// Configure chai
chai.use(chaiHttp);
chai.should();

describe.skip('Units Routes', () => {
  describe('GET /v1/units/', () => {
    it('should get all units', () => {
      chai
        .request(app)
        .get('/v1/units/?useMock=true')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
        });
    });
  });
  describe('GET /v1/units/?id=1', () => {
    it('should get a single unit', () => {
      chai
        .request(app)
        .get('/v1/units/?useMock=true&id=1')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
        });
    });
  });
});
