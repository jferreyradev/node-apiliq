const files = require('../db_apis/files.js');
const { jsonParser } = require("../config/parser");

async function post(req, res, next) {
  try {
    const maxFileSize = 1024 * 1024 * 50; // 50MB; OCI limit is 1 GB unless streaming
    let contentBuffer = [];
    let totalBytesInBuffer = 0;
    let contentType = req.headers['content-type'] || 'application/octet';
    let fileName = req.headers['x-file-name'];

    if (fileName === '') {
      res.status(400).json({error: `The file name must be 
                            passed to the via x-file-name header`});
      return;
    }

    req.on('data', chunk => {      
      contentBuffer.push(chunk);
      totalBytesInBuffer += chunk.length;

      if (totalBytesInBuffer > maxFileSize) {
        req.pause();

        res.header('Connection', 'close');
        res.status(413).json({error: `The file size exceeded the 
                              limit of ${maxFileSize} bytes`});

        req.connection.destroy();
      }
    });

    req.on('end', async function() {
      contentBuffer = Buffer.concat(contentBuffer, totalBytesInBuffer);
      
      try {

        //console.log(contentBuffer.toString() );

        //const fileId = await files.create(fileName, contentType, contentBuffer);
        //res.status(201).json({fileId: fileId});

        const data = await files.getObjects(contentBuffer.toString(), jsonParser.novipsst);
        
        //console.log(JSON.stringify(data));

        res.status(201).json(data);

      } catch (err) {
        console.log(err);

        res.header('Connection', 'close');
        res.status(500).json({error: 'Oops, something broke!'});

        req.connection.destroy();
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports.post = post;

async function get(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
  
      if (isNaN(id)) {
        res.status(400).json({error: `The id of the file must be provided`});
        return;
      }
  
      const rows = await files.get(id);
  
      if (rows.length === 1) {
        res.status(200);
  
        res.set({
          'Cache-Control': 'no-cache',
          'Content-Type': rows[0].content_type,
          'Content-Length': rows[0].file_length,
          'Content-Disposition': 'attachment; filename=' + rows[0].file_name
        });
  
        res.send(rows[0].blob_data);
      } else {
        res.status(404).end();
      }
    } catch (err) {
      next(err);
    }
  }
  
  module.exports.get = get;

  async function getHojaId(req, res, next) {
    try {    
      const { uploadId } = req.query;
      if (!uploadId || !/^[a-f0-9-]{36}$/i.test(uploadId)) {
        res.status(400).json({ error: 'uploadId válido es requerido' });
        return;
      }
      const data = await files.generaNovedadIPSST(uploadId);
      res.status(201).json(data);

      //res.status(201).json();

    } catch (err) {
      console.log(err);

      res.header('Connection', 'close');
      res.status(500).json({error: 'Oops, something broke!'});

      req.connection.destroy();
    }
  }
  module.exports.getHojaId = getHojaId;
