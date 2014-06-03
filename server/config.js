module.exports = function (env) {
  var express = require("express");
  var nunjucks = require( "nunjucks" );
  var path = require('path');
  var app = express();
  var nunjucksEnv = new nunjucks.Environment( new nunjucks.FileSystemLoader( "./public"));
  var appVersion = require('../package').version;
  // ===
  var http = require("http");
  var fs = require('fs');
  var path = require('path');
  var nodemailer = require("nodemailer");
  var mail = nodemailer.mail;
  // create reusable transport method (opens pool of SES connections)
  var sesTransport = nodemailer.createTransport("SES", {
      AWSAccessKeyID: process.env.AWS_KEY_ID,
      AWSSecretKey: process.env.AWS_SECRET_KEY
  });
  var app = express();
  // using a simple text file to store counter
  var counterFile = "counter.txt";
  // Helmet for security headers and features
  var helmet = require('helmet');

  // Set up security header options based on .env settings
  if (process.env.HSTS_DISABLED != 'true') {
    // Use HSTS
    app.use(helmet.hsts());
  }
  if (process.env.DISABLE_XFO_HEADERS_DENY != 'true') {
    // No xframes allowed
    app.use(helmet.xframe('deny'));
  }
  if (process.env.IEXSS_PROTECTION_DISABLED != 'true') {
  // Use XSS protection
    app.use(helmet.iexss());
  }

  app.use(express.logger('dev'));
  app.use(express.compress());
  app.use(express.json());
  app.use(express.urlencoded());

  nunjucksEnv.express( app );
  nunjucksEnv.addFilter( "instantiate", function( input ) {
    var tmpl = new nunjucks.Template( input );
    return tmpl.render( this.getVariables() );
  });

  var config = {
    version: appVersion
  };

  var healthcheck = {
    version: appVersion,
    http: 'okay'
  };

  // Static files
  app.use(express.static('./public'));

  // Serve up virtual configuration "file"
  app.get('/config.js', function (req, res) {
    res.setHeader('Content-type', 'text/javascript');
    res.send('window.eventsConfig = ' + JSON.stringify(config));
  });

  // Healthcheck
  app.get('/healthcheck', function (req, res) {
    getRequestCounter(function(requestCount){
      healthcheck.counter = requestCount;
      res.json(healthcheck);
    });
  });

  app.get('/', function(req, res){
    res.render("views/index.html");
  });

  app.get('/projects', function(req, res){
    res.render("views/projects.html");
  });

  app.get('/about', function(req, res){
    res.render("views/about.html");
  });

  app.get('/resources', function(req, res){
    res.render("views/resources.html");
  });

  app.post("/requestForm", function(req, res){
    // FIXME: check environment type, temp solution, to be fixed by checking env var
    var host = req.get("host");
    var onStaging = host.indexOf("staging") > -1 ? true : false;
    // send request once counter has been fetched
    getRequestCounter(function(requestCount){
        sendRequest(req, res, requestCount, onStaging);
    });
  });

  function sendRequest(req, res, requestCount, onStaging){
    console.log("======= requestForm ========");
    requestCount++; // new request, increase counter by 1
    var name = req.body.name;
    var team = req.body.team;
    var deadline = req.body.deadline;
    var summary = req.body.summary;
    var needTweet = (req.body.needTweet != null);
    var tweet = req.body.tweet;
    var subjectPrefix = onStaging ? "(test on staging) " : "";
    var mailOptions = {
        from: process.env.REQEUST_FROM_EMAIL,
        to: process.env.REQEUST_TO_EMAIL,
        subject: subjectPrefix + "[ Request Form ] #" + requestCount + ", from " + name,
        generateTextFromHTML: true,
        html:   "<b>Requester:</b> " + name + "<br> "
              + "<b>Team: </b>" + team + "<br>"
              + "<b>Deadline: </b>" + deadline + "<br>"
              + "<b>Summary: </b>" + summary
    };
    if ( needTweet ) {
      mailOptions.html += "<br><b>Need Tweet: </b>" + tweet;
    }

    sesTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
            console.log(mailOptions)
            res.render("views/error.html");
        }else{
            console.log("Message sent: " + response.message);
            setRequestCounter(requestCount);
            res.render("views/thankyou.html", { theName: name});
        }
    });
  }

  function setRequestCounter(requestCount){
    fs.writeFile(counterFile, requestCount, function(err) {
      if(err) {
        console.log(err);
      } else {
        console.log(requestCount + " has been saved on " + counterFile);
      }
    });
  }

  function getRequestCounter(callback){
    fs.readFile(counterFile, "utf8", function (err, data) {
      if (err) {
        data = 0;
        console.log(err);
      }
      var requestCount = parseInt(data);
      callback(requestCount);
    });
  }

  return app;
};
