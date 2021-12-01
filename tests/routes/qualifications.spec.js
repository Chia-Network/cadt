import {QualificationMock} from "../../src/models/index.js";
import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../src/server.js';

// Configure chai
chai.use(chaiHttp);
chai.should();

describe("Qualifications Routes", () => {
  describe("GET /v1/qualifications/", () => {
    it("should get all qualifications", (done) => {
      chai.request(app)
        .get('/v1/qualifications/?useMock=true')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
          done();
        });
    });
  });
  describe("GET /v1/qualifications/?id=1", () => {
    it("should get a single qualification", (done) => {
      chai.request(app)
        .get('/v1/qualifications/?useMock=true&id=1')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          done();
        });
    });
  });
});
