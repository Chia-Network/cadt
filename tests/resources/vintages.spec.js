import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../src/server';

// Configure chai
chai.use(chaiHttp);
chai.should();

describe('Vintages Routes', () => {
  describe('GET /v1/vintages/', () => {
    it('should get all vintages', () => {
      chai.request(app)
        .get('/v1/vintages/?useMock=true')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
        });
    });
  });
  describe('GET /v1/vintages/?id=1', () => {
    it('should get a single vintage', () => {
      chai.request(app)
        .get('/v1/vintages/?useMock=true&id=1')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
        });
    });
  });
});
