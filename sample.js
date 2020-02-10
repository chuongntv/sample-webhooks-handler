var https = require("https");
var http = require("http");
var url = require("url");
var crypto = require("crypto");

function eventWebhookError(res, statusCode, errMsg) {
  console.log("Event webhook error: %s", errMsg);
  res.writeHeader(403, {"Content-Type": "text/plain"});
  res.write(errMsg);
  res.write("\n");
  res.end();
}

function checkWebhookSignature(_url, body, signature, key) {
  var hmac = crypto.createHmac('sha256', key)
  hmac.update(_url + body);
  var h = hmac.digest('hex');
  return signature == h
}

var lastDeviceEventJson = null;
var lastDeviceCommandJson = null;
var requestData = [];

//
// Routing
// 
var postRoutes = {
  // webhook endpoint
  "/evt" : function(req, res, body) {
    var sig = req.headers['x-mode-signature'];
    if (!checkWebhookSignature(evt_url, body, sig, evt_key)) {
      eventWebhookError(res, 403, "Signature doesn't match: " + sig);
      return;
    }

    var json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      json = null;
    }

    if (!json) {
      eventWebhookError(res, 400, "Request body is not valid JSON");
      return;
    }

    var origin = json['originDeviceId'];
    var eventType = json['eventType'];
    var eventData = json['eventData'];

    if (!eventType) {
      eventWebhookError(res, 400, "Invalid event object");
      return;
    }

    console.log(json);
    lastDeviceEventJson = json;
    requestData.push(json);

    res.writeHeader(200, {"Content-Type": "text/plain"});
    res.write("Event received.\n");
    res.end();
  },
  "/cmd" : function(req, res, body) {
    var sig = req.headers['x-mode-signature'];
    if (!checkWebhookSignature(cmd_url, body, sig, cmd_key)) {
      eventWebhookError(res, 403, "Signature doesn't match: " + sig);
      return;
    }

    var json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      json = null;
    }

    if (!json) {
      eventWebhookError(res, 400, "Request body is not valid JSON");
      return;
    }

    console.log(json);
    lastDeviceCommandJson = json;
    requestData.push(json);

    res.writeHeader(200, {"Content-Type": "text/plain"});
    res.write("Command received.\n");
    res.end();
  }
};

function handlerNotFound(res, path) {
  res.writeHeader(404, {"Content-Type": "text/plain"});
  res.write("Not Found\n");
  res.end();
}

function executeHandler(req, res, handler) {
  var body = '';
  req.on('data', function(data) {
    body += data;
  });
  req.on('end', function() {
    handler(req, res, body);
  });

}


var doc1 = `
<html>
<body>
`;

var doc2 = `
<script>
setInterval(function() { location.reload(); }, 1000);
</script>
</body>
</html>
`;

function webMainLoop(req, res) {
  var path = url.parse(req.url, true).pathname;
  if (req.method == 'POST') {
    var handler = postRoutes[path];
    if (handler === undefined) {
      handlerNotFound(res, path);
    } else {
      executeHandler(req, res, handler);
    }
  } else if (req.method = 'GET') {
    var data = doc1;
    // res.writeHeader(200, {"Content-Type": "text/html"});
    // if (lastDeviceEventJson === null) {
    //   data = data + "No device event.\n";
    // } else {
    //   data = data + JSON.stringify(lastDeviceEventJson) + "<br/>";
    // }

    // if (lastDeviceCommandJson === null) {
    //   data = data + "No device command.\n" ;
    // } else {
    //   data = data + JSON.stringify(lastDeviceCommandJson) + "<br/>";
    // }
    res.write(data + requestData.join("<br/>") + doc2);
    res.end();
  }
}

var app_port = process.env.PORT || 8000;
var evt_url = process.env.EVENT_URL;
var evt_key = process.env.EVENT_KEY;
var cmd_url = process.env.COMMAND_URL;
var cmd_key = process.env.COMMAND_KEY;

http.createServer(function(req, res){  
  webMainLoop(req, res);
}).listen(app_port);
