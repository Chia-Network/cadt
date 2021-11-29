import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../../src/server';

chai.use(chaiHttp);

export const get = (url) => {
  return new Promise((resolve, reject) => {
    chai.request(app)
      .get(url)
      .end((err, res) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(res);
    
      });
  });
};
