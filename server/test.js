/* global describe beforeEach it before */

process.env.NODE_ENV = 'test'

const parse = require('csv-parse')
const chai = require('chai')
const chaiHttp = require('chai-http')
const web = require('./lib/web')
const database = require('./lib/database')
const assert = require('assert')
const randomstring = require('randomstring')

chai.use(chaiHttp)
chai.should()

const randomBoolean = () => {
  return Math.random() > 0.5
}

describe('API', () => {
  let api = null
  let user = null
  let review = null
  let token = null
  let submissions = null
  const password = randomstring.generate()
  const Submission = require('./lib/models/submission')
  const User = require('./lib/models/user')
  const Review = require('./lib/models/review')
  const Notification = require('./lib/models/notification')
  const Favorite = require('./lib/models/favorite')
  const Configuration = require('./lib/models/configuration')

  before(() => {
    return database.init()
      .then(() => web.init())
      .then((_api) => {
        api = _api
      })
  })

  beforeEach(() => {
    return database.knex('reviews').delete()
      .then(() => {
        return database.knex('submissions').delete()
      })
      .then(() => {
        return database.knex('users').delete()
      })
      .then(() => {
        return database.knex('notifications').delete()
      })
      .then(() => {
        return database.knex('favorites').delete()
      })
      .then(() => {
        return database.knex('configurations').delete()
      })
      .then(() => {
        return Configuration.loadStatic()
      })
      .then(() => {
        user = new User({
          'email': randomstring.generate(),
          'role': 'admin',
          'ready': true,
          'active': true
        })
        user.setPassword(password)
        return user.save()
      })
      .then(() => {
        submissions = []
        for (var i = 0; i < 10; i++) {
          const object = new Submission({
            'source': randomstring.generate(),
            'ip': randomstring.generate(),
            'data': {
              'field1': randomstring.generate(),
              'field2': randomstring.generate()
            },
            'external_id': randomstring.generate(),
            'flagged': randomBoolean(),
            'embargoed': randomBoolean(),
            'pinned': false,
            'autoFlagged': false
          })
          submissions.push(object)
        }
        const nextSave = (pointer) => {
          if (pointer < submissions.length) {
            return submissions[pointer].save().then(() => {
              return nextSave(pointer + 1)
            })
          }
        }
        return nextSave(0)
      })
      .then(() => {
        return Submission.byId(submissions[0].get('id'))
      })
      .then((submission) => {
        return submission.fetch({'withRelated': ['reviews']}).then(() => {
          return submission
        })
      })
      .then((submission) => {
        review = submission.related('reviews').at(0)
        review.set('score', 10)
        return review.save()
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          chai.request(api)
            .post('/api/user/login')
            .send({
              'email': user.get('email'),
              'password': password
            })
            .end((err, res) => {
              if (err || res.body.error) {
                reject(err || new Error(res.body.error))
              } else {
                token = res.body.token
                resolve()
              }
            })
        })
      })
  })

  describe('User', () => {
    it('GET /api/user (Inactive)', (done) => {
      user.set('active', false)
      user.save().then(() => {
        chai.request(api)
          .get('/api/user')
          .set('Authorization', 'JWT ' + token)
          .end((err, res) => { // eslint-disable-line handle-callback-err
            res.should.have.status(401)
            done()
          })
      }).catch((err) => console.log(err))
    })

    it('GET /api/user/login (Inactive)', (done) => {
      user.set('active', false)
      user.save().then(() => {
        chai.request(api)
          .post('/api/user/login')
          .send({
            'email': user.get('email'),
            'password': password
          })
          .end((err, res) => { // eslint-disable-line handle-callback-err
            res.should.have.status(401)
            done()
          })
      }).catch((err) => console.log(err))
    })

    it('GET /api/user (Inactive)', (done) => {
      user.set('active', false)
      user.save().then(() => {
        chai.request(api)
          .get('/api/user')
          .set('Authorization', 'JWT ' + token)
          .end((err, res) => { // eslint-disable-line handle-callback-err
            res.should.have.status(401)
            done()
          })
      }).catch((err) => console.log(err))
    })

    it('GET /api/user/:user', (done) => {
      chai.request(api)
        .get('/api/user/' + user.get('id'))
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.eql(user.get('id'))
            res.body.email.should.be.eql(user.get('email'))
            res.body.role.should.be.eql(user.get('role'))
            res.body.ready.should.be.eql(user.get('ready'))
            done()
          }
        })
    })

    it('GET /api/user/:user/reviews', (done) => {
      chai.request(api)
        .get('/api/user/' + user.get('id') + '/reviews')
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('array')
            res.body.length.should.be.eq(10)
            done()
          }
        })
    })

    it('POST /api/user/:user', (done) => {
      const update = {
        'password': randomstring.generate(),
        'email': randomstring.generate(),
        'role': randomstring.generate(),
        'active': randomBoolean(),
        'ready': randomBoolean()
      }
      chai.request(api)
        .post('/api/user/' + user.get('id'))
        .set('Authorization', 'JWT ' + token)
        .send(update)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.eql(user.get('id'))
            res.body.email.should.be.eql(update.email)
            res.body.role.should.be.eql(update.role)
            res.body.active.should.be.eql(update.active)
            res.body.ready.should.be.eql(update.ready)
            done()
          }
        })
    })

    it('PUT /api/user', (done) => {
      const update = {
        'password': randomstring.generate(),
        'email': randomstring.generate(),
        'role': randomstring.generate(),
        'active': randomBoolean(),
        'ready': randomBoolean()
      }
      chai.request(api)
        .put('/api/user')
        .set('Authorization', 'JWT ' + token)
        .send(update)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.a('number')
            res.body.email.should.be.eql(update.email)
            res.body.role.should.be.eql(update.role)
            res.body.active.should.be.eql(update.active)
            res.body.ready.should.be.eql(update.ready)
            done()
          }
        })
    })

    it('POST /api/user/reset', (done) => {
      chai.request(api)
        .post('/api/user/reset')
        .set('Authorization', 'JWT ' + token)
        .send({
          'email': user.get('email')
        })
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.message.should.be.a('string')

            user.fetch()
              .then(() => {
                assert(user.get('resetCode'))
                assert(user.get('resetExpiration'))
              })
              .then(() => {
                return Notification.forge().fetchAll()
              })
              .then((notifications) => {
                assert.equal(notifications.length, 22)
              })
              .then(() => {
                done()
              })
              .catch((err) => done(err))
          }
        })
    })

    it('GET /api/user/reset/:code (Accept)', (done) => {
      user.set('resetCode', randomstring.generate())
      user.set('resetExpiration', new Date(new Date().getTime() + 1000000000))
      user.save().then(() => {
        chai.request(api)
          .get('/api/user/reset/' + user.get('resetCode'))
          .set('Authorization', 'JWT ' + token)
          .end((err, res) => {
            if (err) {
              done(err)
            } else {
              res.should.have.status(200)
              res.body.should.be.a('object')
              res.body.message.should.be.eq('ok')
              res.body.token.should.be.a('string')
              done()
            }
          })
      }).catch((err) => done(err))
    })

    it('GET /api/user/reset/:code (Reject)', (done) => {
      user.set('resetCode', randomstring.generate())
      user.set('resetExpiration', new Date(new Date().getTime() - 1000000000))
      user.save().then(() => {
        chai.request(api)
          .get('/api/user/reset/' + user.get('resetCode'))
          .set('Authorization', 'JWT ' + token)
          .end((err, res) => { // eslint-disable-line handle-callback-err
            res.should.have.status(404)
            res.body.should.be.a('object')
            done()
          })
      }).catch((err) => done(err))
    })

    it('POST /api/user/:user/reviews/reassign (Blind Reassignment)', (done) => {
      const user2 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': true
      })
      const user3 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': true
      })
      const user4 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': false
      })
      const user5 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': false,
        'active': true
      })
      Promise.all([
        user2.save(),
        user3.save(),
        user4.save(),
        user5.save()
      ])
        .then(() => {
          return user.fetch({'withRelated': ['reviews']})
        })
        .then(() => {
          assert.equal(user.related('reviews').length, submissions.length)
        })
        .then(() => {
          return new Promise((resolve, reject) => {
            chai.request(api)
              .post('/api/user/' + user.get('id') + '/reviews/reassign')
              .set('Authorization', 'JWT ' + token)
              .end((err, res) => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })
          })
        })
        .then(() => {
          return Promise.all([
            user.fetch({'withRelated': ['reviews']}),
            user2.fetch({'withRelated': ['reviews']}),
            user3.fetch({'withRelated': ['reviews']}),
            user4.fetch({'withRelated': ['reviews']}),
            user5.fetch({'withRelated': ['reviews']})
          ])
        })
        .then(() => {
          assert.equal(user.related('reviews').length, 1)
          assert.equal(user2.related('reviews').length, 5)
          assert.equal(user3.related('reviews').length, 4)
          assert.equal(user4.related('reviews').length, 0)
          assert.equal(user5.related('reviews').length, 0)
          done()
        })
        .catch((err) => done(err))
    }).timeout(5000)

    it('POST /api/user/:user/reviews/reassign (Partial Reassignment)', (done) => {
      const user2 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': true
      })
      const user3 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': true
      })
      Promise.all([
        user2.save(),
        user3.save()
      ])
        .then(() => {
          return user.fetch({'withRelated': ['reviews']})
        })
        .then(() => {
          assert.equal(user.related('reviews').length, submissions.length)
        })
        .then(() => {
          return new Promise((resolve, reject) => {
            chai.request(api)
              .post('/api/user/' + user.get('id') + '/reviews/reassign?n=6')
              .set('Authorization', 'JWT ' + token)
              .end((err, res) => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })
          })
        })
        .then(() => {
          return Promise.all([
            user.fetch({'withRelated': ['reviews']}),
            user2.fetch({'withRelated': ['reviews']}),
            user3.fetch({'withRelated': ['reviews']})
          ])
        })
        .then(() => {
          assert.equal(user.related('reviews').length, 4)
          assert.equal(user2.related('reviews').length, 3)
          assert.equal(user3.related('reviews').length, 3)
          done()
        })
        .catch((err) => done(err))
    }).timeout(5000)

    it('POST /api/user/:user/reviews/reassign (Directed Reassignment)', (done) => {
      const user2 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': true
      })
      const user3 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': true
      })
      const user4 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate(),
        'ready': true,
        'active': false
      })
      Promise.all([
        user2.save(),
        user3.save(),
        user4.save()
      ])
        .then(() => {
          return user.fetch({'withRelated': ['reviews']})
        })
        .then(() => {
          assert.equal(user.related('reviews').length, submissions.length)
        })
        .then(() => {
          return new Promise((resolve, reject) => {
            chai.request(api)
              .post('/api/user/' + user.get('id') + '/reviews/reassign?user=' + user3.get('id'))
              .set('Authorization', 'JWT ' + token)
              .end((err, res) => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })
          })
        })
        .then(() => {
          return Promise.all([
            user.fetch({'withRelated': ['reviews']}),
            user2.fetch({'withRelated': ['reviews']}),
            user3.fetch({'withRelated': ['reviews']}),
            user4.fetch({'withRelated': ['reviews']})
          ])
        })
        .then(() => {
          assert.equal(user.related('reviews').length, 1)
          assert.equal(user2.related('reviews').length, 0)
          assert.equal(user3.related('reviews').length, 9)
          assert.equal(user4.related('reviews').length, 0)
          done()
        })
        .catch((err) => done(err))
    }).timeout(5000)

    it('GET /api/user/:user/favorites', (done) => {
      new Favorite({
        'user_id': user.get('id'),
        'submission_id': submissions[0].get('id')
      }).save()
        .then(() => {
          chai.request(api)
            .get('/api/user/' + user.get('id') + '/favorites')
            .set('Authorization', 'JWT ' + token)
            .end((err, res) => {
              if (err) {
                done(err)
              } else {
                res.should.have.status(200)
                res.body.should.be.a('array')
                res.body.length.should.be.eql(1)
                res.body[0].id.should.be.eq(submissions[0].get('id'))
                done()
              }
            })
        })
        .catch((err) => done(err))
    })
  })

  describe('Submission', () => {
    it('GET /api/submission', (done) => {
      chai.request(api)
        .get('/api/submission')
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('array')
            res.body.length.should.be.eql(submissions.length)
            res.body[0].reviews.should.be.a('array')
            res.body[0].reviews.length.should.be.eq(1)
            done()
          }
        })
    })

    it('GET /api/submission/:submission', (done) => {
      chai.request(api)
        .get('/api/submission/' + submissions[0].get('id'))
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.eq(submissions[0].get('id'))
            res.body.source.should.be.eq(submissions[0].get('source'))
            res.body.ip.should.be.eq(submissions[0].get('ip'))
            res.body.data.field1.should.be.eq(submissions[0].get('data').field1)
            res.body.data.field2.should.be.eq(submissions[0].get('data').field2)
            res.body.flagged.should.be.eq(submissions[0].get('flagged'))
            res.body.pinned.should.be.eq(submissions[0].get('pinned'))
            res.body.autoFlagged.should.be.eq(submissions[0].get('autoFlagged'))
            res.body.external_id.should.be.eq(submissions[0].get('external_id'))
            done()
          }
        })
    })

    it('GET /api/submission/:submission/reviews', (done) => {
      chai.request(api)
        .get('/api/submission/' + submissions[0].get('id') + '/reviews')
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('array')
            res.body.length.should.be.eq(1)
            done()
          }
        })
    })

    it('PUT /api/submission', (done) => {
      const newSubmission = {
        'data': {
          'field1': randomstring.generate(),
          'field2': randomstring.generate()
        },
        'pinned': randomBoolean(),
        'flagged': randomBoolean()
      }
      chai.request(api)
        .put('/api/submission')
        .set('Authorization', 'JWT ' + token)
        .send(newSubmission)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.a('number')
            res.body.source.should.be.eq('api')
            res.body.ip.should.be.eq('::ffff:127.0.0.1')
            res.body.data.field1.should.be.eq(newSubmission.data.field1)
            res.body.data.field2.should.be.eq(newSubmission.data.field2)
            res.body.flagged.should.be.eq(newSubmission.flagged)
            res.body.pinned.should.be.eq(newSubmission.pinned)
            res.body.autoFlagged.should.be.eq(false)
            assert.equal(res.body.external_id, null)

            Review.forSubmission(res.body.id)
              .then((reviews) => {
                assert(reviews)
                assert.equal(reviews.length, 1)
              })
              .then(() => {
                return Notification.forge().fetchAll()
              })
              .then((notifications) => {
                assert.equal(notifications.length, 23)
              })
              .then(() => {
                done()
              })
              .catch((err) => done(err))
          }
        })
    })

    it('POST /api/submission/:submission', (done) => {
      const updatedSubmission = {
        'data': {
          'field1': randomstring.generate(),
          'field2': randomstring.generate()
        },
        'pinned': randomBoolean(),
        'flagged': randomBoolean()
      }
      chai.request(api)
        .post('/api/submission/' + submissions[0].get('id'))
        .set('Authorization', 'JWT ' + token)
        .send(updatedSubmission)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.eq(submissions[0].get('id'))
            res.body.source.should.be.eq(submissions[0].get('source'))
            res.body.ip.should.be.eq(submissions[0].get('ip'))
            res.body.data.field1.should.be.eq(updatedSubmission.data.field1)
            res.body.data.field2.should.be.eq(updatedSubmission.data.field2)
            res.body.flagged.should.be.eq(updatedSubmission.flagged)
            res.body.pinned.should.be.eq(updatedSubmission.pinned)
            res.body.autoFlagged.should.be.eq(false)
            res.body.external_id.should.be.eq(submissions[0].get('external_id'))
            done()
          }
        })
    })

    it('POST /api/submission/:submission (Clear autoFlagged)', (done) => {
      submissions[0].set('autoFlagged', true)
      submissions[0].save()
        .then(() => {
          const updateJSON = submissions[0].toJSON()
          updateJSON.autoFlagged = false
          chai.request(api)
            .post('/api/submission/' + submissions[0].get('id'))
            .set('Authorization', 'JWT ' + token)
            .send(updateJSON)
            .end((err, res) => {
              if (err) {
                done(err)
              } else {
                res.should.have.status(200)
                res.body.should.be.a('object')
                res.body.autoFlagged.should.be.eq(false)
                done()
              }
            })
        })
        .catch((err) => done(err))
    })

    it('POST /api/submission/:submission (Ignore autoFlagged)', (done) => {
      const updateJSON = submissions[0].toJSON()
      updateJSON.autoFlagged = true
      chai.request(api)
        .post('/api/submission/' + submissions[0].get('id'))
        .set('Authorization', 'JWT ' + token)
        .send(updateJSON)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.autoFlagged.should.be.eq(false)
            done()
          }
        })
    })

    it('POST /api/submission/:submission (Pinned Limited)', (done) => {
      const submissionJSON = submissions[0].toJSON()
      submissionJSON.pinned = true

      Configuration.updateConfigByKey('pinnedLimit', 1)
        .then(() => {
          return Configuration.loadStatic()
        })
        .then(() => {
          return new Promise((resolve, reject) => {
            chai.request(api)
              .post('/api/submission/' + submissions[0].get('id'))
              .set('Authorization', 'JWT ' + token)
              .send(submissionJSON)
              .end((err, res) => {
                if (err) {
                  reject(err)
                } else {
                  res.should.have.status(200)

                  const submissionJSON1 = submissions[1].toJSON()
                  submissionJSON1.pinned = true
                  chai.request(api)
                    .post('/api/submission/' + submissions[1].get('id'))
                    .set('Authorization', 'JWT ' + token)
                    .send(submissionJSON1)
                    .end((err, res) => { // eslint-disable-line handle-callback-err
                      res.should.have.status(400)
                      resolve()
                    })
                }
              })
          })
        })
        .then(() => done())
        .catch((err) => done(err))
    })

    it('PUT /api/submission/:submission/favorite', (done) => {
      chai.request(api)
        .put('/api/submission/' + submissions[0].get('id') + '/favorite')
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            user.fetch({'withRelated': 'favorites'})
              .then(() => {
                assert.equal(user.related('favorites').length, 1)
                assert.equal(user.related('favorites').at(0).get('id'), submissions[0].get('id'))
                done()
              })
              .catch((err) => done(err))
          }
        })
    })

    it('DELETE /api/submission/:submission/favorite', (done) => {
      new Favorite({
        'user_id': user.get('id'),
        'submission_id': submissions[0].get('id')
      }).save()
        .then(() => {
          return user.fetch({'withRelated': 'favorites'})
        })
        .then(() => {
          assert.equal(user.related('favorites').length, 1)
          assert.equal(user.related('favorites').at(0).get('id'), submissions[0].get('id'))
        })
        .then(() => {
          return new Promise((resolve, reject) => {
            chai.request(api)
              .delete('/api/submission/' + submissions[0].get('id') + '/favorite')
              .set('Authorization', 'JWT ' + token)
              .end((err, res) => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })
          })
        })
        .then(() => {
          return user.fetch({'withRelated': 'favorites'})
        })
        .then(() => {
          assert.equal(user.related('favorites').length, 0)
          done()
        })
        .catch((err) => done(err))
    })

    it('OPTIONS /api/submission/public', (done) => {
      Configuration.updateConfigByKey('allowedPublicSubmissionOrigins', ['localhost:8000'])
        .then(() => {
          return Configuration.loadStatic()
        })
        .then(() => {
          chai.request(api)
            .options('/api/submission/public')
            // .set('Authorization', 'JWT ' + token)
            .set('origin', 'localhost:8000')
            .end((err, res) => {
              if (err) {
                done(err)
              } else {
                res.should.have.status(200)
                res.should.have.header('access-control-allow-origin')
                res.headers['access-control-allow-origin'].should.eq('localhost:8000')
                res.should.have.header('access-control-allow-methods')
                res.headers['access-control-allow-methods'].should.eq('GET,OPTIONS')
                res.should.have.header('access-control-allow-headers')
                res.headers['access-control-allow-headers'].should.eq('Origin, X-Requested-With, Content-Type, Accept')
                done()
              }
            })
        })
        .catch((err) => done(err))
    })

    it('GET /api/submission/public', (done) => {
      const adminFlaggedSubmission = submissions[0]
      const reviewFlaggedSubmission = submissions[1]
      const autoFlaggedSubmission = submissions[2]
      const embargoedSubmssion = submissions[3]
      const eliminatedSubmissions = [
        adminFlaggedSubmission,
        reviewFlaggedSubmission,
        autoFlaggedSubmission,
        embargoedSubmssion
      ].map((submission) => {
        return submission.get('id')
      })

      adminFlaggedSubmission.set('flagged', true)
      autoFlaggedSubmission.set('autoFlagged', true)
      embargoedSubmssion.set('embargoed', true)

      const pinnedSubmissions = submissions
        .filter((submission) => submission.get('pinned') === true)
        .sort((a, b) => {
          return b.get('created_at').getTime() - a.get('created_at').getTime()
        })
        .map((submission) => submission.get('id'))

      reviewFlaggedSubmission.fetch({'withRelated': ['reviews']})
        .then(() => {
          const review = reviewFlaggedSubmission.related('reviews').at(0)
          review.set({
            'score': 0,
            'flagged': true
          })
          return Promise.all([
            review.save(),
            adminFlaggedSubmission.save(),
            autoFlaggedSubmission.save(),
            embargoedSubmssion.save()
          ])
        })
        .then(() => {
          return Configuration.updateConfigByKey('submissionPublicReadAccess', true)
        })
        .then(() => {
          return Configuration.loadStatic()
        })
        .then(() => {
          chai.request(api)
            .get('/api/submission/public')
            // .set('Authorization', 'JWT ' + token)
            .end((err, res) => {
              if (err) {
                done(err)
              } else {
                res.should.have.status(200)
                res.body.should.be.a('array')
                pinnedSubmissions.forEach((submission, i) => {
                  res.body[i].id.should.eq(submission)
                })
                res.body.forEach((submission) => {
                  eliminatedSubmissions.forEach((id) => {
                    submission.id.should.not.eq(id)
                  })
                })
                done()
              }
            })
        })
    })

    it('GET /api/submission/export', (done) => {
      chai.request(api)
        .get('/api/submission/export')
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.csv.should.be.a('string')
            parse(res.body.csv, {'columns': true}, (err, output) => {
              if (err) {
                done(err)
              } else {
                output.should.be.a('array')
                output.forEach((row) => {
                  const submission = submissions.find((submission) => submission.get('id') === parseInt(row.id))
                  assert(submission);
                  [
                    'external_id',
                    'source',
                    'ip'
                  ].forEach((prop) => {
                    row[prop].should.eq(submission.get(prop))
                  });
                  [
                    'pinned',
                    'flagged',
                    'embargoed',
                    'autoFlagged'
                  ].forEach((prop) => {
                    (row[prop] === '1').should.eq(submission.get(prop))
                  });
                  [
                    'field1',
                    'field2'
                  ].forEach((prop) => {
                    row[prop].should.eq(submission.get('data')[prop])
                  });
                  [
                    'created_at',
                    'updated_at'
                  ].forEach((prop) => {
                    row[prop].should.eq(submission.get(prop).toLocaleString())
                  })
                })
                done()
              }
            })
          }
        })
    })
  })

  describe('Review', () => {
    it('GET /api/review/:review', (done) => {
      chai.request(api)
        .get('/api/review/' + review.get('id'))
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.eql(review.get('id'))
            res.body.user_id.should.be.eql(review.get('user_id'))
            res.body.submission_id.should.be.eql(review.get('submission_id'))
            res.body.score.should.be.eql(review.get('score'))
            res.body.user.should.be.a('object')
            res.body.user.id.should.be.eq(user.get('id'))
            res.body.submission.should.be.a('object')
            res.body.submission.id.should.be.eq(submissions[0].get('id'))
            res.body.flagged.should.be.eq(false)
            done()
          }
        })
    })

    it('PUT /api/review (Accept)', (done) => {
      const user2 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate()
      })
      user2.save().then(() => {
        const newReview = {
          'submission_id': submissions[0].get('id'),
          'user_id': user2.get('id'),
          'score': Math.random() * 1000,
          'data': {
            'subfield1': randomstring.generate()
          },
          'flagged': true
        }
        chai.request(api)
          .put('/api/review')
          .set('Authorization', 'JWT ' + token)
          .send(newReview)
          .end((err, res) => {
            if (err) {
              done(err)
            } else {
              res.should.have.status(200)
              res.body.should.be.a('object')
              res.body.id.should.be.a('number')
              res.body.user_id.should.be.eql(newReview.user_id)
              res.body.submission_id.should.be.eql(newReview.submission_id)
              res.body.score.should.be.eql(newReview.score)
              res.body.data.should.be.a('object')
              res.body.data.subfield1.should.be.eq(newReview.data.subfield1)
              res.body.user_id.should.be.eq(user2.get('id'))
              res.body.submission_id.should.be.eq(submissions[0].get('id'))
              res.body.flagged.should.be.eq(true)
              done()
            }
          })
      }).catch((err) => done(err))
    })

    it('PUT /api/review (Reject)', (done) => {
      const newReview = {
        'submission_id': submissions[0].get('id'),
        'user_id': user.get('id'),
        'score': Math.random() * 1000,
        'data': {
          'subfield1': randomstring.generate()
        },
        'flagged': true
      }
      chai.request(api)
        .put('/api/review')
        .set('Authorization', 'JWT ' + token)
        .send(newReview)
        .end((err, res) => { // eslint-disable-line handle-callback-err
          res.should.have.status(400)
          res.body.should.be.a('object')
          res.body.error.should.be.a('string')
          done()
        })
    })

    it('POST /api/review/:review', (done) => {
      const updatedReview = {
        'score': 30,
        'data': {
          'subfield1': randomstring.generate()
        },
        'flagged': true,
        'submission_id': 1000,
        'user_id': 2000
      }
      chai.request(api)
        .post('/api/review/' + review.get('id'))
        .set('Authorization', 'JWT ' + token)
        .send(updatedReview)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            res.body.id.should.be.eql(review.get('id'))
            res.body.user_id.should.be.eql(2000)
            res.body.submission_id.should.be.eql(review.get('submission_id'))
            res.body.score.should.be.eql(updatedReview.score)
            res.body.user.should.be.a('object')
            res.body.user.id.should.be.eq(user.get('id'))
            res.body.submission.should.be.a('object')
            res.body.submission.id.should.be.eq(submissions[0].get('id'))
            res.body.data.should.be.a('object')
            res.body.data.subfield1.should.be.eq(updatedReview.data.subfield1)
            done()
          }
        })
    })

    it('POST /api/review/:review/recuse', (done) => {
      const user2 = new User({
        'email': randomstring.generate(),
        'password': randomstring.generate()
      })
      user2.save()
        .then(() => {
          chai.request(api)
            .post('/api/review/' + review.get('id') + '/recuse')
            .set('Authorization', 'JWT ' + token)
            .end((err, res) => {
              if (err) {
                done(err)
              } else {
                res.should.have.status(200)
                Review
                  .forge()
                  .query({where: {id: review.get('id')}})
                  .fetch()
                  .then((review) => {
                    assert.equal(review.get('user_id'), user2.get('id'))
                  })
                done()
              }
            })
        })
        .catch((err) => done(err))
    })

    it('DELETE /api/review/:review', (done) => {
      chai.request(api)
        .delete('/api/review/' + review.get('id'))
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            Review
              .forge()
              .query({where: {id: review.get('id')}})
              .fetch()
              .then((review) => {
                assert.equal(review, null)
                done()
              })
          }
        })
    })
  })

  describe('Notification', () => {
    it('GET /api/notification', (done) => {
      chai.request(api)
        .get('/api/notification')
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('array')
            res.body.length.should.eq(submissions.length * 2 + 1)
            done()
          }
        })
    })
  })

  describe('Config', () => {
    it('GET /api/config', (done) => {
      chai.request(api)
        .get('/api/config')
        .set('Authorization', 'JWT ' + token)
        .end((err, res) => {
          if (err) {
            done(err)
          } else {
            res.should.have.status(200)
            res.body.should.be.a('object')
            assert.equal(JSON.stringify(Configuration.defaultConfigurations), JSON.stringify(res.body))
            done()
          }
        })
    })
  })
})
