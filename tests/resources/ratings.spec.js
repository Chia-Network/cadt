import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../src/server';

// Configure chai
chai.use(chaiHttp);
chai.should();

describe('Ratings Routes', () => {
  describe('GET /v1/ratings/', () => {
    it('should get all ratings', () => {
      chai.request(app)
        .get('/v1/ratings/?useMock=true')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
        });
    });
  });
  describe('GET /v1/ratings/?id=1', () => {
    it('should get a single rating', () => {
      chai.request(app)
        .get('/v1/ratings/?useMock=true&id=1')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
        });
    });
  });
});
