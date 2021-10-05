#!/usr/bin/env node

import minimist from "minimist";
import commist from "commist";
import fs from "fs/promises";

const usage = (msg = "URL to Postman CLI Tool") => {
  console.log(` \n${msg}\n `);
  console.log("url-to-postman:");
  console.log(
    `convert: url-to-postman <path> - path to input file (newline delimited list of urls)
        --host=<host> - opt - override host (e.g. with a variable)
        --name=<name> - opt - name of collection
        --output=<path> - opt - output of Postman JSON
        `
  );
};

const noMatches = commist()
  .register("convert", urlToPostman)
  .parse(process.argv.slice(2));
if (noMatches) {
  usage();
  process.exit(1);
}

async function urlToPostman(argv) {
  const args = minimist(argv, {
    string: ["output", "name", "host"],
  });
  if (args._.length < 1) {
    usage();
    process.exit(1);
  }

  const [filePath] = args._;
  const { output, name, host } = args;

  let urlList;
  try {
    urlList = (await fs.readFile(filePath, "utf-8")).split("\n");
    urlList = urlList.filter((item) => item !== "");
    if (urlList.length < 1) throw new Error("File seems to be empty");
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }

  let postmanJSON;
  try {
    const item = urlList.map((url) => urlToItem(url, host))
    console.log(item)
    postmanJSON = {
      info: {
        name,
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item,
    };
  } catch (error) {
    console.error(`Error generating Postman JSON ${error.message}`);
    process.exit(1);
  }

  try {
      if (output) {
        await fs.writeFile(output, JSON.stringify(postmanJSON, "", 4));
        console.log(`Output saved to ${output}`);
      } else {
        console.log(postmanJSON);
      }
  } catch (error) {
    console.error(`Error outputting Postman JSON ${error.message}`);
    process.exit(1);
  }
}

function urlToItem(url, host) {
  const item = {};
  item.name = url;
  item.request = {};
  item.request.method = "GET";
  item.request.header = [];
  item.request.url = {};
  item.request.url.raw = url;
  const doubleSlashSplit = url.split("//");
  const singleSlashSplit = doubleSlashSplit[1].split("/");
  const parsedHost = doubleSlashSplit[0] + "//" + singleSlashSplit.shift()
  item.request.url.host = host ? host : parsedHost ;
  const querySplit = singleSlashSplit.pop().split("?");
  singleSlashSplit.push(querySplit[0]);
  item.request.url.path = singleSlashSplit;

  item.request.url.query = parseQueryParams(querySplit[1]);

  return item;
}

function parseQueryParams(queryString) {
  return queryString.split("&").map((query) => {
    const split = query.split("=");
    return {
      key: split[0],
      value: split[1],
    };
  });
}
