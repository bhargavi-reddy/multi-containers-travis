const keys = require("./keys");

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

//POSTGRES SET UP
const { Pool } = require("pg");
const { pgDatabase, pgPassword, pgPort } = require("./keys");
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: pgDatabase,
  password: pgPassword,
  port: pgPort,
});
pgClient.on("error", () => console.log("lost PG connection"));

pgClient.query(`CREATE TABLE IF NOT EXISTS values (index INT)`);

//REDIS CLIENT SET UP
const redis = require("redis");
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});

const redisPublisher = redisClient.duplicate();

//Express route handlers

app.get("/", (req, res) => {
  res.send("Hi...");
});

app.get("/values/all", async (req, res) => {
  try {
    console.log("MAKING A QUERY");
    const values = await pgClient.query(`SELECT * FROM values;`);
    res.send(values.rows);
  } catch (error) {
    console.log(`ERROR OCCURED....... ${error}`);
  }
});

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const index = req.body.index;
  if (parseInt(index) > 40) {
    return res.status(422).send(`Index too high`);
  }
  redisClient.hset("values", index, "Nothing yet");
  redisPublisher.publish("insert", index);
  pgClient.query(`INSERT INTO values(index) VALUES ($1)`, [index]);
  res.send({ working: true });
});

app.listen(5000, (err) => {
  console.log("Listening on port 5000");
});
