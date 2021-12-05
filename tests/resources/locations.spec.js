import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../src/server';

// Configure chai
chai.use(chaiHttp);
chai.should();

describe('Locations Routes', () => {
  describe('GET /v1/locations/', () => {
    it('should get all locations', () => {
      chai.request(app)
        .get('/v1/locations/?useMock=true')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
        });
    });
  });
  describe('GET /v1/locations/?id=1', () => {
    it('should get a single location', () => {
      chai.request(app)
        .get('/v1/locations/?useMock=true&id=1')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
        });
    });
  });
});
