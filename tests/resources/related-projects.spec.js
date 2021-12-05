import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../src/server';

// Configure chai
chai.use(chaiHttp);
chai.should();

describe('Related Projects Routes', () => {
  describe('GET /v1/related-projects/', () => {
    it('should get all related projects', () => {
      chai.request(app)
        .get('/v1/related-projects/?useMock=true')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
        });
    });
  });
  describe('GET /v1/related-projects/?id=1', () => {
    it('should get a single related project', () => {
      chai.request(app)
        .get('/v1/related-projects/?useMock=true&id=1')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
        });
    });
  });
});
