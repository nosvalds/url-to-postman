#!/usr/bin/env node

import minimist from "minimist";
import commist from "commist";
import fs from "fs/promises";
import path from "path";

const usage = (msg = "URL to Postman CLI Tool") => {
  console.log(` \n${msg}\n `);
  console.log("url-to-postman:");
  console.log(
    `convert: url-to-postman <path> - path to input file (newline delimited list of urls)
        --name=<name> - req - name of collection
        --host=<host> - opt - override host (e.g. with a variable)
        --outpath=<path> - opt - output path of Postman JSON
        --split=<int> - opt - number of requests per collection, before splitting
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
    string: ["outpath", "name", "host", "split"],
  });
  if (args._.length < 1) {
    usage();
    process.exit(1);
  }

  const [filePath] = args._;
  const { outpath, name, host, split } = args;

  let urlList;
  try {
    urlList = (await fs.readFile(filePath, "utf-8")).split("\n");
    urlList = urlList.filter((item) => item !== "");
    if (urlList.length < 1) throw new Error("File seems to be empty");
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }

  let urlLists = [];
  if (split) {
    while (urlList.length > 0) {
      urlLists.push(urlList.splice(0, split));
    }
  } else {
    urlLists = [urlList];
  }
  let postmanJSONs;
  try {
    postmanJSONs = urlLists.map((urlList, i) => {
      const item = urlList.map((url) => urlToItem(url, host));
      return {
        info: {
          name: split ? `${name}-${i + 1}` : name,
          schema:
            "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item,
      };
    });
  } catch (error) {
    console.error(`Error generating Postman JSON: ${error.message}`, error);
    process.exit(1);
  }

  try {
    if (outpath) {
      postmanJSONs.forEach(async (postmanJSON, i) => {
        await fs.writeFile(
          path.join(outpath, `${split ? `${name}-${i + 1}` : name}.postman_collection.json`),
          JSON.stringify(postmanJSON, "", 4)
        );
      });
      console.log(`Output saved to ${outpath}`);
    } else {
      postmanJSONs.forEach((postmanJSON, i) => {
        console.log(postmanJSON);
      });
    }
  } catch (error) {
    console.error(`Error outputting Postman JSON: ${error.message}`);
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
  const parsedHost = doubleSlashSplit[0] + "//" + singleSlashSplit.shift();
  item.request.url.host = host ? host : parsedHost;
  const querySplit = singleSlashSplit.pop().split("?");
  singleSlashSplit.push(querySplit[0]);
  item.request.url.path = singleSlashSplit;

  item.request.url.query = parseQueryParams(querySplit[1]);

  return item;
}

function parseQueryParams(queryString) {
  if (queryString) {
    return queryString.split("&").map((query) => {
      const split = query.split("=");
      return {
        key: split[0],
        value: split[1],
      };
    });
  }
  return {};
}
