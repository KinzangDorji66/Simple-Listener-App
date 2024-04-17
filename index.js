const bodyParser = require("body-parser");
const express = require("express");
const { connect, StringCodec, nkeyAuthenticator } = require('nats');
const dotev = require("dotenv");


const ANSII_GREEN = "\u001b[32m";
const ANSII_RESET = "\x1b[0m";

const app = express();

dotev.config({ path: './.env' });
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
  const message = req.body;
  const reqHeaders = req.headers;

  console.log(`Request headers: ${JSON.stringify(reqHeaders)}`);
  console.log("Got message on the webhook");
  let date = new Date();
  console.log(date)
  console.log(
    `${ANSII_GREEN}${JSON.stringify(message, null, 4)}${ANSII_RESET}`
  );
  res.status(202).send("Accepted");
});

async function natsListener(threadId) {
  const nc = await connect(
    {
      servers: process.env.NATS_URL,
      authenticator: nkeyAuthenticator(new TextEncoder().encode(process.env.NATS_SEED))
    }
  );
  console.log("Connected to NATS server")
  const sc = StringCodec();
  const sub = nc.subscribe(threadId);
  console.log(`Subscribing to NATS with threadId: ${threadId}`)
  let natsResponseResolve;
  const natsResponse = new Promise(function (resolve) {
    natsResponseResolve = resolve;
  });

  (async () => {
    for await (const m of sub) {
      const { data } = JSON.parse(sc.decode(m.data));
      natsResponseResolve(data);
    }
  })();
  const responseData = await natsResponse;
  return responseData;
}

app.get('/subscribe/:threadId', async (req, res) => {
  const { threadId } = req.params;
  
  try {
    const result = await natsListener(threadId);
    console.log("Response received and returning the result.")
    res.json({ result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/publish', async (req, res) => {
  
  try {
    const nc = await connect(
      {
        servers: process.env.NATS_URL,
        authenticator: nkeyAuthenticator(new TextEncoder().encode(process.env.NATS_SEED))
      }
    );
    console.log("Connected to NATS server")
    const data = req.body;

    nc.publish(data);

    res.send("Published data to NATS")
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`App running on port ${process.env.PORT}`);
});
