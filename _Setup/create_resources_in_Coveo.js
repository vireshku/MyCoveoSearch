require('isomorphic-fetch');
require('abortcontroller-polyfill');

const { PlatformClient, SourceVisibility, SourceType, } = require('@coveord/platform-client');
const fs = require('fs')

const { OAuth } = require('@coveo/cli/lib/lib/oauth/oauth')

const PLATFORM = process.env.PLATFORM || 'production';

class Config {

    constructor(orgName) {
        this.config = {};
        try {
            this.config = JSON.parse(fs.readFileSync('.config.json').toString());
        }
        catch (e) {
            console.error('Reading .config.json', e);
        }

        this.orgName = orgName;
    }

    async login() {
        let response = null;
        if (this.config?.accessToken) {
            try {
                response = await this.validateAccessTokenAndOrg();
            }
            catch (err) {
                console.log('Login failed', err)
            }
        }

        if (!this.config?.accessToken || response?.errorCode === 'INVALID_TOKEN') {
            await this.loginGetAccessToken();
            this.writeConfig();
            await this.validateAccessTokenAndOrg();
        }
    }

    async validateAccessTokenAndOrg() {
        this.client = new PlatformClient({ accessToken: this.config.accessToken, environment: PLATFORM });
        let res = null;
        try {
            res = await getOrganization(this.client, this.config.orgName);
        }
        catch (err) {
            console.log('[ERR-002] Token validation failed.', err);
        }
        return res;

    }

    async loginGetAccessToken() {

        const { accessToken } = await new OAuth({
            environment: 'dev', //Environment.prod, // flags.environment as PlatformEnvironment,
            region: process.env.REGION || 'us', // flags.region as Region,
        }).getToken();

        this.config.accessToken = accessToken;

    }

    get accessToken() { return this.config.accessToken; }
    set accessToken(s) { this.config.accessToken = s; }

    get client() { return this.config.client; }
    set client(s) { this.config.client = s; }

    get organizationId() { return this.config.orgId; }
    set organizationId(s) { this.config.orgId = s; }

    get organizationName() { return this.config.orgName; }
    set organizationName(s) { this.config.orgName = s; }


    writeConfig() {
        fs.writeFileSync('.config.json', JSON.stringify(this.config));
    }
}


async function createOrganization(orgName) {
    const accessToken = CONFIG.accessToken;
    const environment = PLATFORM;
    CONFIG.client = new PlatformClient({ accessToken, environment, });

    let orgs = await getOrganization(CONFIG.client, orgName);
    if (orgs.length >= 1) {
        console.log(`\n ⚠️  Org "${orgName}" already exists.\n`);
    }
    else {
        console.log('Creating org: ', orgName);
        const createOrgResponse = await CONFIG.client.organization.create({
            name: orgName,
            // owner,
            organizationTemplate: 'Developer'
        }).catch(handleError.bind(null, `organization.create(${orgName})`));
        orgs = await getOrganization(CONFIG.client, createOrgResponse.id);
    }

    // should have only one org that matches here.
    const targetOrg = orgs[0];

    console.log('Using org: ', targetOrg.displayName, ` [${targetOrg.id}]`);
    CONFIG.organizationId = targetOrg.id;
    CONFIG.client = new PlatformClient({ accessToken, environment, organizationId: CONFIG.organizationId });
}

function readArguments() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log(`\n\t⚠️  Missing arguments\n\n\tUsage: node setup_generic_store_demo.js <orgName>\n\n`);
        process.exit(1);
    }

    return {
        ORG_NAME: args[0].trim()
    };
}

async function getOrganization(client, name) {
    let resources = await client.organization.list(); // no catch, we want to throw here
    resources = resources.filter(res => (res.id.trim() === name || res.displayName.trim() === name));
    return resources;
  }


async function main(ARGS) {

    console.log('main', 'Done.\n');

    CONFIG = new Config(ARGS.ORG_NAME);
    await CONFIG.login();

    const divider = '\n------------------------------------------------\n';

    await createOrganization(ARGS.ORG_NAME);
    // await createCatalogSource('Products');
    // await createPushSource('Stores');
    // await createFields();
    // await createMappings();
    // await createModels();
    // await createPipelines();

    // await createCatalogConfiguration();

    console.log(divider, 'Done.\n');
}

main(readArguments());
