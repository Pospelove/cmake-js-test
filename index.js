// iterate directory node_modules
// and get all files

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const dir = path.join(__dirname, 'node_modules');
const files = fs.readdirSync(dir);

let result = "";

const repoOverrides = {
  "ansi-regex": "chalk/ansi-regex",
  "ansi-styles": "chalk/ansi-styles",
  "cliui": "yargs/cliui",
  "color-convert": "Qix-/color-convert",
  "delegates": "visionmedia/node-delegates",
  "escalade": "lukeed/escalade",
  "inherits": "isaacs/inherits",
  "is-fullwidth-code-point": "sindresorhus/is-fullwidth-code-point",
  "lodash.isplainobject": "lodash/lodash", // todo: fix this
  "lru-cache": "isaacs/node-lru-cache",
  "mime-db": "jshttp/mime-db",
  "mime-types": "jshttp/mime-types",
  "ms": "vercel/ms",
  "string-width": "sindresorhus/string-width",
  "strip-ansi": "chalk/strip-ansi",
  "strip-json-comments": "sindresorhus/strip-json-comments",
  "wrap-ansi": "chalk/wrap-ansi",
  "y18n": "yargs/y18n",
}

const revisionOverrides = {
  "iarna/console-control-strings": "b678af0f5584fc91d52778b57c985a21c1605b04",
  // Error 404 for lodash/lodash
  "dominictarr/rc": "a97f6adcc37ee1cad06ab7dc9b0bd842bbc5c664",
  "troygoode/node-require-directory": "d1fd7dc2eaf02832de94dbe1af0c52271697050e",
  "iarna/wide-align": "c1bf09df8a2c549d68a7a0e65315db89d0eff457",
  "yargs/yargs-parser": "yargs-parser-v21.1.1"
}

const main = async () => {
  let i = 0, n = files.length;
  for (let file of files) {
    i++;
    console.log(`[${i}/${n}] ${file}`);
    if ([".bin", ".package-lock.json", "lodash.isplainobject"].indexOf(file) > -1) {
      continue;
    }

    const packageJson = require(path.join(dir, file, 'package.json'));

    let repo = packageJson.repository.url;
    if (repo === undefined) {
      if (repoOverrides[packageJson.name] === undefined) {
        console.log(`Package ${file} has no repository`);
        continue;
      } else {
        repo = repoOverrides[packageJson.name];
      }
    }
    if (repo.startsWith("git") || repo.startsWith("http")) {
      // replace : with /
      repo = repo.replace(/:/g, "/");
      // split by / and get two last elements (user/repo)
      repo = repo.split("/").slice(-2).join("/");
      // remove .git suffix
      repo = repo.replace(/\.git$/, "");
    }

    let refsToTry = [packageJson.version, "v" + packageJson.version];
    if (revisionOverrides[repo] !== undefined) {
      refsToTry = [];
      refsToTry.push(revisionOverrides[repo]);
    }

    let goodRef = null;
    let sha512 = "0";

    for (let ref of refsToTry) {

      const archiveUrl = `https://github.com/${repo}/archive/${ref}.tar.gz`;

      // download file and get sha512  
      try {
        const response = await axios.get(archiveUrl, {
          responseType: 'arraybuffer'
        });
        goodRef = ref;
        // get response buffer to variable responseBuffer
        const responseBuffer = Buffer.from(response.data, 'binary');
        // get sha512
        sha512 = require('crypto').createHash('sha512').update(responseBuffer).digest('hex');

      } catch (e) {
        // get error code
        const code = e.response.status;
        if (code !== 404) {
          throw e;
        }
        //console.log(`Error ${code} for ${archiveUrl}`);
      }
    }
    if (!goodRef) {
      console.log(`Error 404 for ${repo}`);
    }

    result += "vcpkg_from_github(\n";
    result += `    OUT_SOURCE_PATH SOURCE_PATH\n`;
    result += `    REPO ${repo}\n`;
    result += `    REF ${goodRef}\n`;
    result += `    SHA512 ${sha512}\n`;
    result += `    HEAD_REF master\n`;
    result += `)\n\n`;

    result += `file(INSTALL "\${SOURCE_PATH}" DESTINATION "\${node_modules_download_dir}" RENAME "${file}")\n\n`;
  }

  // print result to output.cmake
  fs.writeFileSync('output.cmake', result);
}

main().catch(console.error);