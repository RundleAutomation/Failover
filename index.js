
var express = require('express');
var app = express();

app.use(express.static(__dirname));
app.use(express.static(__dirname + '/node_modules'));
app.get('/', function(req, res) {
    res.sendFile('./index.html', {root: __dirname });
});
var server = app.listen(8007, function () {
    console.log('Server is running on 8007...');
});
