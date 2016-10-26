var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;

var app = express();

var jsonParser = bodyParser.json();

var Message = require('./models/message');
var User = require('./models/user');

var state = {
    loggedIn: false,
    userId: "",
    username: ""
};

// Add your API endpoints here
var runServer = function(callback) {
    var databaseUri = process.env.DATABASE_URI || global.databaseUri || 'mongodb://localhost/auth';
    mongoose.Promise = global.Promise;
    mongoose.connect(databaseUri).then(function() {
        var port = process.env.PORT || 8080;
        //var port = process.env.PORT || 3000;
        var server = app.listen(port, function() {
            console.log('Listening on localhost:' + port);
            if (callback) {
                callback(server);
            }
        });
    });
};

var strategy = new BasicStrategy(function(username, password, callback) {
    User.findOne({
        username: username
    }, function (err, user) {
        if (err) {
            callback(err);
            return;
        }

        if (!user) {
            return callback(null, false, {
                message: 'Incorrect username.'
            });
        }
        state.userId = user._id.toString();
        state.username = user.username;
        user.validatePassword(password, function(err, isValid) {
            if (err) {
                return callback(err);
            }

            if (!isValid) {
                return callback(null, false, {
                    message: 'Incorrect password.'
                });
            }
            return callback(null, user);
        });
    });
});

passport.use(strategy);

app.use(passport.initialize());


app.get('/hidden', passport.authenticate('basic', {session: false}), function(req, res) {
    state.loggedIn = true;
    res.json({
        message: 'Authenticated...'
    });
});



// app.post('/message', jsonParser, function(req, res) {
//     Message.create({from: "bob", to: "sue", text: "hello"}, function(err, message){
//         if (err) {
//             res.json(err);
//         }
        
//         res.json(message);
//     })
    
// })

//Messages API
app.get('/messages', jsonParser, passport.authenticate('basic', {session: false}), function(req, res) {
    var query = {};
    if (req.query.to !== undefined) {
        query.to = req.query.to;
    }
    if (req.query.from !== undefined) {
        query.from = req.query.from;
    }
    
    
    Message.find(query).populate('from to').exec(function(err, messages) {
        if(err) {
            return res.status(500).json({
               message: 'Server Error' 
            });
        }
        var userMessages = []
        if (messages.length > 0) {
            for (var i = 0; i < messages.length; i++) {
                if (messages[i].from.username === state.username) {
                    userMessages.push(messages[i]);
                }
            }
            return res.status(200).json(userMessages);
        }
        res.status(200).json(messages);
    });
});

app.post('/messages', jsonParser, passport.authenticate('basic', {session: false}), function(req, res) {
    
        if (req.body.text === undefined) {
            return res.status(422).json({
                message: "Missing field: text"
            });
        } else if (typeof req.body.text !== 'string') {
            return res.status(422).json({
                message: "Incorrect field type: text"
            });
        } else if (typeof req.body.to !== 'string') {
            return res.status(422).json({
               message: "Incorrect field type: to"
            });
        } else if (typeof req.body.from !== 'string') {
            return res.status(422).json({
                message: "Incorrect field type: from"
            });
        }
    if (req.body.from === state.userId) {
        User.find({_id: state.userId}, function(err, user){
            User.find({_id: req.body.to}, function(err, user2){
                if (user.length === 0 && user) {
                    return res.status(422).json({
                        message: "Incorrect field value: from"
                    });
                }
                if (user2.length === 0 && user2) {
                    return res.status(422).json({
                        message: "Incorrect field value: to"
                    });
                }
                Message.create({text: req.body.text, from: req.body.from, to: req.body.to}, function(err, message) {
                    if (err) {
                        return res.status(500).json({
                        message: "Server Error"
                    });
                } 
                res.location('/messages/' + message._id);
                res.status(201).json({});
                });
            });
        });
    } else {
        return res.status(422).json({
            message: "Incorrect field value: from"
        });
    }
});

app.get('/messages/:messageId', passport.authenticate('basic', {session: false}), function(req, res) {
    Message.findById(req.params.messageId).populate('from to').exec(function(err, message) {
        if (err) {
            return res.status(500).json({
                message: "Server Error"
            });
        } else if (!message) {
            return res.status(404).json({
                message: "Message not found"
            });
        }
        if (message.from.username === state.username) {
            return res.status(200).json(message);
        } else {
            return res.status(401).json({
                message: "Not Authorized"
            })
        }
    });
});

//User API
app.get('/users', passport.authenticate('basic', {session: false}), function(req, res) {
    User.find(function(err, users) {
        if(err) {
            return res.status(500).json({
              message: 'Server Error' 
            });
        }
        // console.log(users);
        res.status(200).json(users);
    });
});

app.get('/users/:userId', function(req, res) {
    User.findById(req.params.userId, function(err, user) {
       if(err) {
           return res.status(500).json({
               message: 'Server Error'
           });
       } else if (!user) {
           return res.status(404).json({
               message: 'User not found'
           });
       } else {
           var userRes = {
               username: user.username,
               _id: user._id
           };
           res.status(200).json(userRes);
       }
    });
});

app.post('/users', jsonParser, function (req, res) {
    if(!req.body) {
        return res.status(422).json({
            message: "Missing field: username"
        });
    }
    
    if (!('username' in req.body)) {
        return res.status(422).json({
            message: 'Missing field: username'
        });
    }

    var username = req.body.username;

    if (typeof username !== 'string') {
        return res.status(422).json({
            message: 'Incorrect field type: username'
        });
    }

    username = username.trim();

    if (username === '') {
        return res.status(422).json({
            message: 'Incorrect field length: username'
        });
    }

    if (!('password' in req.body)) {
        return res.status(422).json({
            message: 'Missing field: password'
        });
    }

    var password = req.body.password;

    if (typeof password !== 'string') {
        return res.status(422).json({
            message: 'Incorrect field type: password'
        });
    }

    password = password.trim();

    if (password === '') {
        return res.status(422).json({
            message: 'Incorrect field length: password'
        });
    }

    bcrypt.genSalt(10, function(err, salt) {
        if (err) {
            return res.status(500).json({
                message: 'Internal server error'
            });
        }

        bcrypt.hash(password, salt, function(err, hash) {
            if (err) {
                return res.status(500).json({
                    message: 'Internal server error'
                });
            }

            var user = new User({
                username: username,
                password: hash
            });
            user.save().then(function(user) {
                res.location('/users/' + user._id).set('x-myUserId', user._id).status(201).json({});
            }).catch(function (err) {
                res.status(500).json({
                    message: 'Internal server error'
                });
            })
        });
    });

});



//  second app.post
app.post('/users/:userId', jsonParser, function (req, res) {
    if(!req.body) {
        return res.status(422).json({
            message: "Missing field: username"
        });
    }
    
    if (!('username' in req.body)) {
        return res.status(422).json({
            message: 'Missing field: username'
        });
    }

    var username = req.body.username;

    if (typeof username !== 'string') {
        return res.status(422).json({
            message: 'Incorrect field type: username'
        });
    }

    username = username.trim();

    if (username === '') {
        return res.status(422).json({
            message: 'Incorrect field length: username'
        });
    }

    if (!('password' in req.body)) {
        return res.status(422).json({
            message: 'Missing field: password'
        });
    }

    var password = req.body.password;

    if (typeof password !== 'string') {
        return res.status(422).json({
            message: 'Incorrect field type: password'
        });
    }

    password = password.trim();

    if (password === '') {
        return res.status(422).json({
            message: 'Incorrect field length: password'
        });
    }

    bcrypt.genSalt(10, function(err, salt) {
        if (err) {
            return res.status(500).json({
                message: 'Internal server error'
            });
        }

        bcrypt.hash(password, salt, function(err, hash) {
            if (err) {
                return res.status(500).json({
                    message: 'Internal server error'
                });
            }

            var user = new User({
                username: username,
                password: hash
            });

            user.save(function(err) {
                if (err) {
                    return res.status(500).json({
                        message: 'Internal server error'
                    });
                }

                return res.status(201).json({});
            });
        });
    });

});




app.put('/users/:userId', jsonParser, function(req, res) {
    if(!req.body.hasOwnProperty('username')) {
        res.status(422).json({
            message: "Missing field: username"
        });
    } else if ((typeof req.body.username) === 'string'){
        User.findByIdAndUpdate(req.params.userId, {username: req.body.username}, {upsert: true}, function(err, user) {
            if(err) {
                return res.status(500).json({
                    message: 'Server Error'
                });
            }
            res.status(200).json({});
        });
    } else {
        res.status(422).json({
            message: "Incorrect field type: username"
        });
    }
    
    
});

app.delete('/users/:userId', jsonParser, function(req, res) {
    User.findByIdAndRemove(req.params.userId, function(err, user) {
        if(err) {
           return res.status(500).json({
               message: 'Server Error'
           });
       } else if (!user) {
           return res.status(404).json({
               message: 'User not found'
           });
       } else {
           res.status(200).json({});
       }     
    });
});

if (require.main === module) {
    runServer();
};
exports.app = app;
exports.runServer = runServer;