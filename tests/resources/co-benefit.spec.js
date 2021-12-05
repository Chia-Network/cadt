import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../src/server';

// Configure chai
chai.use(chaiHttp);
chai.should();

describe('Co-Benefits Routes', () => {
  describe('GET /v1/co-benefits/', () => {
    it('should get all co-benefits', () => {
      chai.request(app)
        .get('/v1/co-benefits/?useMock=true')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
        });
    });
  });
  describe('GET /v1/co-benefits/?id=1', () => {
    it('should get a single co-benefit', () => {
      chai.request(app)
        .get('/v1/co-benefits/?useMock=true&id=1')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
        });
    });
  });
});
