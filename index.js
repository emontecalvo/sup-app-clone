var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');

var app = express();

var jsonParser = bodyParser.json();

var Message = require('./models/message')
var User = require('./models/user')

// Add your API endpoints here
var runServer = function(callback) {
    var databaseUri = process.env.DATABASE_URI || global.databaseUri || 'mongodb://localhost/sup';
    mongoose.connect(databaseUri).then(function() {
        var port = process.env.PORT || 8080;
        var server = app.listen(port, function() {
            console.log('Listening on localhost:' + port);
            if (callback) {
                callback(server);
            }
        });
    });
};

if (require.main === module) {
    runServer();
};

//Messages API
app.get('/messages', jsonParser,function(req, res) {
    var query = {} ;
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
        //console.log(messages);
        res.status(200).json(messages);
    });
});

app.post('/messages', jsonParser, function(req, res) {
    if (req.body.text === undefined) {
        return res.status(422).json({
            message: "Missing field: text"
        })
    } else if (typeof req.body.text !== 'string') {
        return res.status(422).json({
            message: "Incorrect field type: text"
        })
    } else if (typeof req.body.to !== 'string') {
        return res.status(422).json({
           message: "Incorrect field type: to"
        })
    } else if (typeof req.body.from !== 'string') {
        return res.status(422).json({
            message: "Incorrect field type: from"
        })
    }
    
    User.find({_id: req.body.from}, function(err, user){
        User.find({_id: req.body.to}, function(err, user2){
            if (user.length === 0) {
                return res.status(422).json({
                    message: "Incorrect field value: from"
                })
            }
            if (user2.length === 0) {
                return res.status(422).json({
                    message: "Incorrect field value: to"
                })
            }
            Message.create({text: req.body.text, from: req.body.from, to: req.body.to}, function(err, message) {
                if (err) {
                    return res.status(500).json({
                    message: "Server Error"
                });
            } 
            res.location('/messages/' + message._id);
            res.status(201).json({})
            });
        })
    })
});

app.get('/messages/:messageId', function(req, res) {
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
        res.status(200).json(message);
    });
});

//User API
app.get('/users', function(req, res) {
    User.find(function(err, users) {
        if(err) {
            return res.status(500).json({
              message: 'Server Error' 
            });
        }
        res.status(200).json(users);
    });
});

app.get('/users/:userId', function(req, res) {
    User.findById(req.params.userId, function(err, user) {
       if(err) {
           return res.status(500).json({
               message: 'Server Error'
           });
       } else if (user === null) {
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
    if(Object.keys(req.body).length === 0) {
        res.status(422).json({
            message: "Missing field: username"
        });
    } else if ((typeof req.body.username) === 'string'){
        User.create({
            username: req.body.username 
        }, function(err, user) {
            if(err) {
                return res.status(500).json({
                    message: 'Server Error'
                });
            }
            res.location('/users/' + user._id);
            res.status(201).json({});
        });
    } else {
        res.status(422).json({
            message: "Incorrect field type: username"
        });
    }
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
            res.status(200).json({})
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
       } else if (user === null) {
           return res.status(404).json({
               message: 'User not found'
           });
       } else {
           res.status(200).json({});
       }     
    });
});

exports.app = app;
exports.runServer = runServer;

