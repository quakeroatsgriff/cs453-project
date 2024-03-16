const express = require('express');
const bodyParser = require('body-parser');
const fse = require('fs-extra');

const app = express();
const jsonParser = bodyParser.json();

const PORT_NUMBER = 3000
app.use( express.static( 'public'));

// function onLookupWord(req, res) {
//     const routeParams = req.params;
//     const word = routeParams.word;

//     const key = word.toLowerCase();
//     const definition = englishDictionary[key];

//     res.json({
//         word: word,
//         definition: definition
//     });
// }
// app.get('/lookup/:word', onLookupWord);

// async function onSetWord(req, res) {
//     const routeParams = req.params;
//     const word = routeParams.word;
//     const definition = req.body.definition;
//     const key = word.toLowerCase();
//     englishDictionary[key] = definition;
//     // Write the entry back to the JSON file.
//     await fse.writeJson('./dictionary.json', englishDictionary);
//     res.json({ success: true});
// }
// app.post('/set/:word', jsonParser, onSetWord);

app.listen(PORT_NUMBER, () => console.log(`Server is listening on port ${PORT_NUMBER}...`));

