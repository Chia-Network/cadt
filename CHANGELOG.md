# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.0.6](https://github.com/Chia-Network/climate-warehouse/compare/v0.0.4...v0.0.6) (2022-01-27)


### Features

* add custom validation for the serialnumberblock ([88d47c0](https://github.com/Chia-Network/climate-warehouse/commit/88d47c0c85afd4befee3a3b04ea4c5fb1d4b8f3e))
* add database mirror operations ([f999f86](https://github.com/Chia-Network/climate-warehouse/commit/f999f86cc142f24b38dd28b7bf490a5278987b8d))
* add datalayer simulatorv2 ([4529c22](https://github.com/Chia-Network/climate-warehouse/commit/4529c2260c22705415f4febeeaa337932a9f239c))
* add default env ([eec3a25](https://github.com/Chia-Network/climate-warehouse/commit/eec3a25c84ed8d0f7f9354f894d58c685e874018))
* add local test mirror db and safe db mirror utility ([2973b9f](https://github.com/Chia-Network/climate-warehouse/commit/2973b9f146ccf4a9a61e4921700708d55731f280))
* add meta table ([ecec61b](https://github.com/Chia-Network/climate-warehouse/commit/ecec61b278d200d5a067d95808f7c81534c6000f))
* add orgUid indexes to primary tables ([13054b8](https://github.com/Chia-Network/climate-warehouse/commit/13054b8766185a8ce8d8971332d4de930896a5e7))
* add required serialnumberpattern ([a5e5403](https://github.com/Chia-Network/climate-warehouse/commit/a5e5403f7f2b9b64675264df8116ca01efce382f))
* add uuid validation to update and delete controller ([3a2b071](https://github.com/Chia-Network/climate-warehouse/commit/3a2b07150a343f25625727f4671bcc28379b383e))
* add validation schema ([9b4f82d](https://github.com/Chia-Network/climate-warehouse/commit/9b4f82ddc90e47c8af77d76db3678150b7d4ac43))
* add vintage api ([3f19653](https://github.com/Chia-Network/climate-warehouse/commit/3f19653cd33f57907e4d1047bd3b3e4e664a891f))
* add vintage validation in units ([8b5b1c0](https://github.com/Chia-Network/climate-warehouse/commit/8b5b1c0d424ab4d5e0162b2dae228f92d18138b2))
* Added integration tests for unit ([260f748](https://github.com/Chia-Network/climate-warehouse/commit/260f74822dbc999519c402c7ed3bce0b77c5b320))
* allow custom serial number format in units ([78ed438](https://github.com/Chia-Network/climate-warehouse/commit/78ed4380b0c000510dac0c600b08d3322a901c01))
* auto assign orguid ([6d6cbd2](https://github.com/Chia-Network/climate-warehouse/commit/6d6cbd20e6be6b4a006daa849b78310b48605714))
* batch upload can insert and update records ([ab5fad1](https://github.com/Chia-Network/climate-warehouse/commit/ab5fad1e05af70c4b1a462cae48bed29ef18410c))
* bulk db insert with batch upload ([26705bb](https://github.com/Chia-Network/climate-warehouse/commit/26705bb8c0fb3d1057d7cf87c0def25c5243e2bd))
* clock stubs in unit tests ([32fabfd](https://github.com/Chia-Network/climate-warehouse/commit/32fabfdbd1b4654d5b5aab8abc327438c38c49ea))
* csv batch upload for units and projects ([c1e73e2](https://github.com/Chia-Network/climate-warehouse/commit/c1e73e2bdc3b7f0fd8a1daa09b1d151af0a13b97))
* datalayer organization setup ([6150001](https://github.com/Chia-Network/climate-warehouse/commit/615000187b319b2272d24c58dd5f4aa97eed7b3f))
* fix optional validations in units ([05a690f](https://github.com/Chia-Network/climate-warehouse/commit/05a690f40847ca774721373af2261071dc5d651d))
* fts params for units ([20e3236](https://github.com/Chia-Network/climate-warehouse/commit/20e323621196c1faa5a59dd39e3dd51df7a6a50f))
* fuly resolved changelist ([1796ba1](https://github.com/Chia-Network/climate-warehouse/commit/1796ba1bb6c37308bd55be0b5d395ad5519afd6e))
* orgId filtering in units & projects ([b14583a](https://github.com/Chia-Network/climate-warehouse/commit/b14583ac9d946342e1f1bc451c824661ddee97b2))
* prevent to attempt to modify records outside your home org ([300f273](https://github.com/Chia-Network/climate-warehouse/commit/300f27334c8db665bfc72709d9780595fbea5507))
* remove old stub logic ([a275632](https://github.com/Chia-Network/climate-warehouse/commit/a2756322c9dfb4462104b76b3a0730bc236dc3a1))
* rename qualifications to labels ([e843a86](https://github.com/Chia-Network/climate-warehouse/commit/e843a86fb828348837524efbc64c3380abb3886b))
* rename vintage model to insuance model ([34d064e](https://github.com/Chia-Network/climate-warehouse/commit/34d064e5410678b2d0d70b019f02c281b2bfd50f))
* setup for binary output ([89ff22c](https://github.com/Chia-Network/climate-warehouse/commit/89ff22c4413992322ce63acd3643474660bd27e1))
* simplify routes ([5df63a5](https://github.com/Chia-Network/climate-warehouse/commit/5df63a5773cbada4101e5cec400f562ff0c1f7d3))
* some tweaks to xsl import ([d5bfeee](https://github.com/Chia-Network/climate-warehouse/commit/d5bfeee8eeec9bb89f6121fa2441bd8b6bee0e2f))
* specify columns for api responses ([3fd8268](https://github.com/Chia-Network/climate-warehouse/commit/3fd826807e599aae607264dba5b3dfc31d66845e))
* sync data from simulator ([3aa019e](https://github.com/Chia-Network/climate-warehouse/commit/3aa019e314914c967cbd182ffa98c65bcb8fc760))
* sync database as a single transaction ([50111da](https://github.com/Chia-Network/climate-warehouse/commit/50111da0d80751a1fe01f9c5cb3ac67c0dfaa165))
* sync the orgUid back to cw ([4a9cd0b](https://github.com/Chia-Network/climate-warehouse/commit/4a9cd0b4eb6e55df8ae5e0f8762e3678536bb451))
* unit columns/cleanup ([53b4921](https://github.com/Chia-Network/climate-warehouse/commit/53b49219245454211aad117755e553d5560a7209))
* update datamodel ([ecbd3af](https://github.com/Chia-Network/climate-warehouse/commit/ecbd3af6193ac1eec9f753dea11fe2285728dc70))
* update datamodel to latest and setup mysql connection ([1e0291e](https://github.com/Chia-Network/climate-warehouse/commit/1e0291e8554bbe6c12246074a2b17ca4aff915ef))
* use fake timers in tests ([8bfbc22](https://github.com/Chia-Network/climate-warehouse/commit/8bfbc2205722dbb9bcfb3d795e89a105993c1923))
* use hosted org icons instead of embedded svg ([978e59a](https://github.com/Chia-Network/climate-warehouse/commit/978e59a9cbb61ec7b58cd92e22f1d2799684f40a))
* use uuid as primary key for all global tables ([8b5ffdd](https://github.com/Chia-Network/climate-warehouse/commit/8b5ffddd73f631c6e35b062eaaa5bf9be95ea150))
* xls export -- association data shape ([d93688f](https://github.com/Chia-Network/climate-warehouse/commit/d93688f833a6217b770ed1c8d9c4146f0ea90017))
* xls export for projects and units finalize ([cd55335](https://github.com/Chia-Network/climate-warehouse/commit/cd55335af0bd2f5ba3a7b2e7d31cf40a3591339c))
* xls export for projects and units finalize ([853f0ce](https://github.com/Chia-Network/climate-warehouse/commit/853f0ce5d20fc6887b270551f4e9cc38c918b298))
* xls export for projects and units finalize ([86451d8](https://github.com/Chia-Network/climate-warehouse/commit/86451d8404f1245ea1983f50ec4d9ef18677f985))
* xls export for projects and units finalize ([b2122ac](https://github.com/Chia-Network/climate-warehouse/commit/b2122ac3ea591bd0469db98dc0388441ad5610b4))
* xls export for projects and units finalize ([f449e98](https://github.com/Chia-Network/climate-warehouse/commit/f449e9832da873e60150fff6b200ee99745240d3))
* xls export for projects and units finalize ([4b7e223](https://github.com/Chia-Network/climate-warehouse/commit/4b7e223035e7db0b4270464018426a9d6b6625b1))
* xls export for units ([e386a13](https://github.com/Chia-Network/climate-warehouse/commit/e386a13740966b4e51761ec033db276245b21556))
* xls project output finalized with hex encoding and csv ([4b41d5e](https://github.com/Chia-Network/climate-warehouse/commit/4b41d5ef31dd81b40973ca44b37adc35dbd6e175))
* xlsx 1:1 value support for root table ([caa3204](https://github.com/Chia-Network/climate-warehouse/commit/caa3204d3feab6986ac97336734be02deb481c67))
* xsl export ([4a3c0e8](https://github.com/Chia-Network/climate-warehouse/commit/4a3c0e8f3fd921918f9479ba235783e8cfab4969))
* xsl export ([6164ad3](https://github.com/Chia-Network/climate-warehouse/commit/6164ad3711ea89c9676df2ff7fd31f893a445744))
* xsl export ([ce24c90](https://github.com/Chia-Network/climate-warehouse/commit/ce24c90c062e942878d2ed80243e62348912718f))
* xsl export -- projects shape finishing touches ([c3be53a](https://github.com/Chia-Network/climate-warehouse/commit/c3be53a4cbbe23805db79e25a00dfe68b21fa42b))


### Bug Fixes

* add search ([e6f5a67](https://github.com/Chia-Network/climate-warehouse/commit/e6f5a67975c2bc80dd8ed8c3d54b6a0816792d96))
* allow child table updates in schema ([d0b5dc4](https://github.com/Chia-Network/climate-warehouse/commit/d0b5dc4336c0217c382506d13f35f9b7fe4a657b))
* allow tags to be empty strings ([357fe9a](https://github.com/Chia-Network/climate-warehouse/commit/357fe9a9e13983f959c31ac3c01b66530ff3a862))
* currupted data can not be committed to stage ([bf06ee7](https://github.com/Chia-Network/climate-warehouse/commit/bf06ee73c1b13061e8a392fb194a7ea8cba7be75))
* db sync error ([54fb675](https://github.com/Chia-Network/climate-warehouse/commit/54fb67562e492c2c34310c234cc527ca93fffb72))
* don't crash for dashes at beginning and end of search queries ([b3adcc7](https://github.com/Chia-Network/climate-warehouse/commit/b3adcc7f1db42efcd22ef1351c476683d5903c61))
* dynamic root model name ([069fb0d](https://github.com/Chia-Network/climate-warehouse/commit/069fb0db55e44ba72ef5245aed82e011827ca428))
* dynamic root model name ([0423b0d](https://github.com/Chia-Network/climate-warehouse/commit/0423b0dfb26bebc4403135aa40dca84187437eb7))
* error message ([5a45a35](https://github.com/Chia-Network/climate-warehouse/commit/5a45a3583f79c0d69b002f58d5f2ec7cff3bf2db))
* fix data assertion usage ([53c1627](https://github.com/Chia-Network/climate-warehouse/commit/53c1627037a2c51764e71dfe5bc2bd29771d553e))
* model updates ([8cee623](https://github.com/Chia-Network/climate-warehouse/commit/8cee623fea3e21e2e1364b036cd696af106ad65a))
* move where ([48fb530](https://github.com/Chia-Network/climate-warehouse/commit/48fb5303e2f25c5cf5d278671180029073da911a))
* remove console.log ([046d72e](https://github.com/Chia-Network/climate-warehouse/commit/046d72eec3e0bb8837be67b112e9e1bb59b0734e))
* remove extraneous joi alternative schemas ([12357ce](https://github.com/Chia-Network/climate-warehouse/commit/12357ce088ac97b0687f822d45a76ded953b49e4))
* remove ide config from branch ([bb7d956](https://github.com/Chia-Network/climate-warehouse/commit/bb7d956d79aa6cad5a2049aeef90d40356084fa1))
* remove unused code in organization model ([02d2ab0](https://github.com/Chia-Network/climate-warehouse/commit/02d2ab025c16d956f24167b1ad5b80a5547c5185))
* return resolved org info instead of raw ([94a6a29](https://github.com/Chia-Network/climate-warehouse/commit/94a6a29c3d96801e801e7df485e9ed72ca3f10cf))
* units columns ([554cce6](https://github.com/Chia-Network/climate-warehouse/commit/554cce67debb208797f897d9a0f746291c8941dc))
* units columns fts edge case ([3fa4ff9](https://github.com/Chia-Network/climate-warehouse/commit/3fa4ff91b71d7c052ae4ca9cb7207292e031bd20))

### [0.0.5](https://github.com/Chia-Network/climate-warehouse/compare/v0.0.4...v0.0.5) (2022-01-17)


### Features

* add custom validation for the serialnumberblock ([88d47c0](https://github.com/Chia-Network/climate-warehouse/commit/88d47c0c85afd4befee3a3b04ea4c5fb1d4b8f3e))
* add database mirror operations ([f999f86](https://github.com/Chia-Network/climate-warehouse/commit/f999f86cc142f24b38dd28b7bf490a5278987b8d))
* add local test mirror db and safe db mirror utility ([2973b9f](https://github.com/Chia-Network/climate-warehouse/commit/2973b9f146ccf4a9a61e4921700708d55731f280))
* add orgUid indexes to primary tables ([13054b8](https://github.com/Chia-Network/climate-warehouse/commit/13054b8766185a8ce8d8971332d4de930896a5e7))
* add uuid validation to update and delete controller ([3a2b071](https://github.com/Chia-Network/climate-warehouse/commit/3a2b07150a343f25625727f4671bcc28379b383e))
* add validation schema ([9b4f82d](https://github.com/Chia-Network/climate-warehouse/commit/9b4f82ddc90e47c8af77d76db3678150b7d4ac43))
* add vintage validation in units ([8b5b1c0](https://github.com/Chia-Network/climate-warehouse/commit/8b5b1c0d424ab4d5e0162b2dae228f92d18138b2))
* Added integration tests for unit ([260f748](https://github.com/Chia-Network/climate-warehouse/commit/260f74822dbc999519c402c7ed3bce0b77c5b320))
* allow custom serial number format in units ([78ed438](https://github.com/Chia-Network/climate-warehouse/commit/78ed4380b0c000510dac0c600b08d3322a901c01))
* auto assign orguid ([6d6cbd2](https://github.com/Chia-Network/climate-warehouse/commit/6d6cbd20e6be6b4a006daa849b78310b48605714))
* batch upload can insert and update records ([ab5fad1](https://github.com/Chia-Network/climate-warehouse/commit/ab5fad1e05af70c4b1a462cae48bed29ef18410c))
* clock stubs in unit tests ([32fabfd](https://github.com/Chia-Network/climate-warehouse/commit/32fabfdbd1b4654d5b5aab8abc327438c38c49ea))
* csv batch upload for units and projects ([c1e73e2](https://github.com/Chia-Network/climate-warehouse/commit/c1e73e2bdc3b7f0fd8a1daa09b1d151af0a13b97))
* fix optional validations in units ([05a690f](https://github.com/Chia-Network/climate-warehouse/commit/05a690f40847ca774721373af2261071dc5d651d))
* fts params for units ([20e3236](https://github.com/Chia-Network/climate-warehouse/commit/20e323621196c1faa5a59dd39e3dd51df7a6a50f))
* orgId filtering in units & projects ([b14583a](https://github.com/Chia-Network/climate-warehouse/commit/b14583ac9d946342e1f1bc451c824661ddee97b2))
* prevent to attempt to modify records outside your home org ([300f273](https://github.com/Chia-Network/climate-warehouse/commit/300f27334c8db665bfc72709d9780595fbea5507))
* remove old stub logic ([a275632](https://github.com/Chia-Network/climate-warehouse/commit/a2756322c9dfb4462104b76b3a0730bc236dc3a1))
* simplify routes ([5df63a5](https://github.com/Chia-Network/climate-warehouse/commit/5df63a5773cbada4101e5cec400f562ff0c1f7d3))
* specify columns for api responses ([3fd8268](https://github.com/Chia-Network/climate-warehouse/commit/3fd826807e599aae607264dba5b3dfc31d66845e))
* unit columns/cleanup ([53b4921](https://github.com/Chia-Network/climate-warehouse/commit/53b49219245454211aad117755e553d5560a7209))
* update datamodel to latest and setup mysql connection ([1e0291e](https://github.com/Chia-Network/climate-warehouse/commit/1e0291e8554bbe6c12246074a2b17ca4aff915ef))
* use fake timers in tests ([8bfbc22](https://github.com/Chia-Network/climate-warehouse/commit/8bfbc2205722dbb9bcfb3d795e89a105993c1923))
* use hosted org icons instead of embedded svg ([978e59a](https://github.com/Chia-Network/climate-warehouse/commit/978e59a9cbb61ec7b58cd92e22f1d2799684f40a))
* use uuid as primary key for all global tables ([8b5ffdd](https://github.com/Chia-Network/climate-warehouse/commit/8b5ffddd73f631c6e35b062eaaa5bf9be95ea150))


### Bug Fixes

* add search ([e6f5a67](https://github.com/Chia-Network/climate-warehouse/commit/e6f5a67975c2bc80dd8ed8c3d54b6a0816792d96))
* allow tags to be empty strings ([357fe9a](https://github.com/Chia-Network/climate-warehouse/commit/357fe9a9e13983f959c31ac3c01b66530ff3a862))
* model updates ([8cee623](https://github.com/Chia-Network/climate-warehouse/commit/8cee623fea3e21e2e1364b036cd696af106ad65a))
* move where ([48fb530](https://github.com/Chia-Network/climate-warehouse/commit/48fb5303e2f25c5cf5d278671180029073da911a))
* remove console.log ([046d72e](https://github.com/Chia-Network/climate-warehouse/commit/046d72eec3e0bb8837be67b112e9e1bb59b0734e))
* remove unused code in organization model ([02d2ab0](https://github.com/Chia-Network/climate-warehouse/commit/02d2ab025c16d956f24167b1ad5b80a5547c5185))
* units columns ([554cce6](https://github.com/Chia-Network/climate-warehouse/commit/554cce67debb208797f897d9a0f746291c8941dc))
* units columns fts edge case ([3fa4ff9](https://github.com/Chia-Network/climate-warehouse/commit/3fa4ff91b71d7c052ae4ca9cb7207292e031bd20))

### [0.0.4](https://github.com/Chia-Network/climate-warehouse/compare/v0.0.2...v0.0.4) (2022-01-07)


### Features

* add mandatory associations to models ([abe5085](https://github.com/Chia-Network/climate-warehouse/commit/abe50858c5879404ae32a0c13f21d6c09c88512e))
* add organization api ([441af68](https://github.com/Chia-Network/climate-warehouse/commit/441af68e4c4de7e8121f0df0bbc47f4fb3a436d5))
* add orgUid query param ([f66066d](https://github.com/Chia-Network/climate-warehouse/commit/f66066d5829850d4d7662d4020b10646e489ee38))
* add query param to only return essential columns ([a21be7d](https://github.com/Chia-Network/climate-warehouse/commit/a21be7d23bfe2d580a79908bcb708146635714a7))
* add simulator ([d87d7c7](https://github.com/Chia-Network/climate-warehouse/commit/d87d7c7d60b8726b9ec3b1e367900832d3b1a062))
* add split api ([bc37fcd](https://github.com/Chia-Network/climate-warehouse/commit/bc37fcd91462a77c3a475b9135a9dedccd9f369c))
* add terraform storage config ([e971ded](https://github.com/Chia-Network/climate-warehouse/commit/e971ded5019f9b4a620ffd7f986b965be1344f76))
* add uuid to units model ([17a76de](https://github.com/Chia-Network/climate-warehouse/commit/17a76dedfaa129ff6713ebca65fb5bfc66b33e45))
* add validation for pagination params ([a4e428d](https://github.com/Chia-Network/climate-warehouse/commit/a4e428d38d2c9e0675ec113844224960626c2a83))
* add vintage_unit junction ([4dc71a6](https://github.com/Chia-Network/climate-warehouse/commit/4dc71a6784077a9a0fa60043f72fe9c5e9a2247d))
* consolidate migrations and model ([72200ad](https://github.com/Chia-Network/climate-warehouse/commit/72200ad187119e5e0aeb61b94b83ff25030f8c1c))
* controller resolves all relationships in response ([f0b819c](https://github.com/Chia-Network/climate-warehouse/commit/f0b819c31b10756a4cee9e39671a78a2882ef010))
* encode data for storage ([bc4a1a1](https://github.com/Chia-Network/climate-warehouse/commit/bc4a1a17a90beffb975d03eab180998220cf5cc4))
* fts on projects and units ([e5297ed](https://github.com/Chia-Network/climate-warehouse/commit/e5297ed34462070a7cef6c36e852b981299a7916))
* handle associations ([a41dca9](https://github.com/Chia-Network/climate-warehouse/commit/a41dca9aeb8b230a7442ce8c4f8006f8f6ee9acc))
* handle staging commit ([b33ed49](https://github.com/Chia-Network/climate-warehouse/commit/b33ed491078783416fa27ef19f165439c039d219))
* only migrate fts if using sqlite ([fd29dff](https://github.com/Chia-Network/climate-warehouse/commit/fd29dff223b96abb28dfd8055c8f7fa49d0787db))
* perfect associations, seed association data, eager loading ([5c011a2](https://github.com/Chia-Network/climate-warehouse/commit/5c011a2ac611d980391b2a2ffc63d76c6dd673b9))
* project pagination ([679c197](https://github.com/Chia-Network/climate-warehouse/commit/679c197c7091e7020c2a37df1847960c5532234d))
* proper pagination responses ([5fb4019](https://github.com/Chia-Network/climate-warehouse/commit/5fb40193aa87ec6fd6ee4a021467c4ed1e6b820f))
* qualifications plural ([67e3567](https://github.com/Chia-Network/climate-warehouse/commit/67e3567694f4b81d5f7d93dce74a2efa2b6782cd))
* sqlite and mysql fts queries ([e787862](https://github.com/Chia-Network/climate-warehouse/commit/e787862b2b87349ef450b04975a7c7555e531a57))
* stagin table uses upserts ([d2773bc](https://github.com/Chia-Network/climate-warehouse/commit/d2773bcade031f7ca5e38f053e7581fade4b64a3))
* triggers for fts on units and projects in sqlite ([ef451f8](https://github.com/Chia-Network/climate-warehouse/commit/ef451f850b4a6ffde20981fab15588fbe523f2e4))
* units pagination ([9132891](https://github.com/Chia-Network/climate-warehouse/commit/913289142b7df8903c1d3783d1ebcdf27f463a69))
* update a websocket live when changes are committed ([bada67c](https://github.com/Chia-Network/climate-warehouse/commit/bada67ca7373201272342787b2dd3af1a7071939))


### Bug Fixes

* api validations ([97195c1](https://github.com/Chia-Network/climate-warehouse/commit/97195c17deeb695354cdece19bb826fb390e0b89))
* delete staging data returns correct data, return array for diff data ([0b1bf40](https://github.com/Chia-Network/climate-warehouse/commit/0b1bf4005791c785a355410bf1ce286c84a2e771))
* dont commit staging records that have already been commited ([419b9ce](https://github.com/Chia-Network/climate-warehouse/commit/419b9cecc1894fb735da008896a5b30f1ba886f9))
* fts fixes so that they are index correctly ([c801d3f](https://github.com/Chia-Network/climate-warehouse/commit/c801d3f5fe984587664f7e1f5085c8959a6ff203))
* import ([b7735ce](https://github.com/Chia-Network/climate-warehouse/commit/b7735ce5323ad88f48a6b951129f291a4c2fe103))
* more fts fixes ([8ace0d9](https://github.com/Chia-Network/climate-warehouse/commit/8ace0d9fa9205afcd691a47050087042bdf79e24))
* organization stub ([1c52a95](https://github.com/Chia-Network/climate-warehouse/commit/1c52a951d0dbc2710febc2f85de427ba7baa6add))
* page count in pagination ([f99da50](https://github.com/Chia-Network/climate-warehouse/commit/f99da500e2bfd928a3a7c4103f5bae9fe5868503))
* paginated response for projects ([c79bb2b](https://github.com/Chia-Network/climate-warehouse/commit/c79bb2bb69369f1c5120819a256c4897e7e4136a))
* pagination args in fts queries ([da3370f](https://github.com/Chia-Network/climate-warehouse/commit/da3370f87dd087774c43783adddc28f58e50f554))
* pagination offset calc ([ccb6d34](https://github.com/Chia-Network/climate-warehouse/commit/ccb6d348da7ed7e84459bf70249419951423cdf8))
* pagination optional ([8ed44f3](https://github.com/Chia-Network/climate-warehouse/commit/8ed44f3b4ead5355d60a79721a24803edf46eb79))
* param name ([f7ddebc](https://github.com/Chia-Network/climate-warehouse/commit/f7ddebc976b43e8047747a181ffb30b7538a5ad0))
* qualifications join ([f2eed4e](https://github.com/Chia-Network/climate-warehouse/commit/f2eed4e9e4f09f23a388963b8069e9bbff691ed7))
* split unit validation ([985fa97](https://github.com/Chia-Network/climate-warehouse/commit/985fa97bca9f98f2315624ec6d915152443f4995))
* websocket subscriptions ([548afd4](https://github.com/Chia-Network/climate-warehouse/commit/548afd42974776795467f4df8b505ee825262568))

### [0.0.3](https://github.com/Chia-Network/climate-warehouse/compare/v0.0.2...v0.0.3) (2022-01-07)


### Features

* add mandatory associations to models ([abe5085](https://github.com/Chia-Network/climate-warehouse/commit/abe50858c5879404ae32a0c13f21d6c09c88512e))
* add organization api ([441af68](https://github.com/Chia-Network/climate-warehouse/commit/441af68e4c4de7e8121f0df0bbc47f4fb3a436d5))
* add orgUid query param ([f66066d](https://github.com/Chia-Network/climate-warehouse/commit/f66066d5829850d4d7662d4020b10646e489ee38))
* add query param to only return essential columns ([a21be7d](https://github.com/Chia-Network/climate-warehouse/commit/a21be7d23bfe2d580a79908bcb708146635714a7))
* add simulator ([d87d7c7](https://github.com/Chia-Network/climate-warehouse/commit/d87d7c7d60b8726b9ec3b1e367900832d3b1a062))
* add split api ([bc37fcd](https://github.com/Chia-Network/climate-warehouse/commit/bc37fcd91462a77c3a475b9135a9dedccd9f369c))
* add terraform storage config ([e971ded](https://github.com/Chia-Network/climate-warehouse/commit/e971ded5019f9b4a620ffd7f986b965be1344f76))
* add uuid to units model ([17a76de](https://github.com/Chia-Network/climate-warehouse/commit/17a76dedfaa129ff6713ebca65fb5bfc66b33e45))
* add validation for pagination params ([a4e428d](https://github.com/Chia-Network/climate-warehouse/commit/a4e428d38d2c9e0675ec113844224960626c2a83))
* add vintage_unit junction ([4dc71a6](https://github.com/Chia-Network/climate-warehouse/commit/4dc71a6784077a9a0fa60043f72fe9c5e9a2247d))
* consolidate migrations and model ([72200ad](https://github.com/Chia-Network/climate-warehouse/commit/72200ad187119e5e0aeb61b94b83ff25030f8c1c))
* controller resolves all relationships in response ([f0b819c](https://github.com/Chia-Network/climate-warehouse/commit/f0b819c31b10756a4cee9e39671a78a2882ef010))
* encode data for storage ([bc4a1a1](https://github.com/Chia-Network/climate-warehouse/commit/bc4a1a17a90beffb975d03eab180998220cf5cc4))
* fts on projects and units ([e5297ed](https://github.com/Chia-Network/climate-warehouse/commit/e5297ed34462070a7cef6c36e852b981299a7916))
* handle associations ([a41dca9](https://github.com/Chia-Network/climate-warehouse/commit/a41dca9aeb8b230a7442ce8c4f8006f8f6ee9acc))
* handle staging commit ([b33ed49](https://github.com/Chia-Network/climate-warehouse/commit/b33ed491078783416fa27ef19f165439c039d219))
* only migrate fts if using sqlite ([fd29dff](https://github.com/Chia-Network/climate-warehouse/commit/fd29dff223b96abb28dfd8055c8f7fa49d0787db))
* perfect associations, seed association data, eager loading ([5c011a2](https://github.com/Chia-Network/climate-warehouse/commit/5c011a2ac611d980391b2a2ffc63d76c6dd673b9))
* project pagination ([679c197](https://github.com/Chia-Network/climate-warehouse/commit/679c197c7091e7020c2a37df1847960c5532234d))
* proper pagination responses ([5fb4019](https://github.com/Chia-Network/climate-warehouse/commit/5fb40193aa87ec6fd6ee4a021467c4ed1e6b820f))
* qualifications plural ([67e3567](https://github.com/Chia-Network/climate-warehouse/commit/67e3567694f4b81d5f7d93dce74a2efa2b6782cd))
* sqlite and mysql fts queries ([e787862](https://github.com/Chia-Network/climate-warehouse/commit/e787862b2b87349ef450b04975a7c7555e531a57))
* stagin table uses upserts ([d2773bc](https://github.com/Chia-Network/climate-warehouse/commit/d2773bcade031f7ca5e38f053e7581fade4b64a3))
* triggers for fts on units and projects in sqlite ([ef451f8](https://github.com/Chia-Network/climate-warehouse/commit/ef451f850b4a6ffde20981fab15588fbe523f2e4))
* units pagination ([9132891](https://github.com/Chia-Network/climate-warehouse/commit/913289142b7df8903c1d3783d1ebcdf27f463a69))
* update a websocket live when changes are committed ([bada67c](https://github.com/Chia-Network/climate-warehouse/commit/bada67ca7373201272342787b2dd3af1a7071939))


### Bug Fixes

* api validations ([97195c1](https://github.com/Chia-Network/climate-warehouse/commit/97195c17deeb695354cdece19bb826fb390e0b89))
* delete staging data returns correct data, return array for diff data ([0b1bf40](https://github.com/Chia-Network/climate-warehouse/commit/0b1bf4005791c785a355410bf1ce286c84a2e771))
* dont commit staging records that have already been commited ([419b9ce](https://github.com/Chia-Network/climate-warehouse/commit/419b9cecc1894fb735da008896a5b30f1ba886f9))
* fts fixes so that they are index correctly ([c801d3f](https://github.com/Chia-Network/climate-warehouse/commit/c801d3f5fe984587664f7e1f5085c8959a6ff203))
* import ([b7735ce](https://github.com/Chia-Network/climate-warehouse/commit/b7735ce5323ad88f48a6b951129f291a4c2fe103))
* more fts fixes ([8ace0d9](https://github.com/Chia-Network/climate-warehouse/commit/8ace0d9fa9205afcd691a47050087042bdf79e24))
* organization stub ([1c52a95](https://github.com/Chia-Network/climate-warehouse/commit/1c52a951d0dbc2710febc2f85de427ba7baa6add))
* page count in pagination ([f99da50](https://github.com/Chia-Network/climate-warehouse/commit/f99da500e2bfd928a3a7c4103f5bae9fe5868503))
* paginated response for projects ([c79bb2b](https://github.com/Chia-Network/climate-warehouse/commit/c79bb2bb69369f1c5120819a256c4897e7e4136a))
* pagination args in fts queries ([da3370f](https://github.com/Chia-Network/climate-warehouse/commit/da3370f87dd087774c43783adddc28f58e50f554))
* pagination offset calc ([ccb6d34](https://github.com/Chia-Network/climate-warehouse/commit/ccb6d348da7ed7e84459bf70249419951423cdf8))
* pagination optional ([8ed44f3](https://github.com/Chia-Network/climate-warehouse/commit/8ed44f3b4ead5355d60a79721a24803edf46eb79))
* param name ([f7ddebc](https://github.com/Chia-Network/climate-warehouse/commit/f7ddebc976b43e8047747a181ffb30b7538a5ad0))
* qualifications join ([f2eed4e](https://github.com/Chia-Network/climate-warehouse/commit/f2eed4e9e4f09f23a388963b8069e9bbff691ed7))
* split unit validation ([985fa97](https://github.com/Chia-Network/climate-warehouse/commit/985fa97bca9f98f2315624ec6d915152443f4995))
* websocket subscriptions ([548afd4](https://github.com/Chia-Network/climate-warehouse/commit/548afd42974776795467f4df8b505ee825262568))

### [0.0.2](https://github.com/Chia-Network/climate-warehouse/compare/v0.0.1...v0.0.2) (2021-12-10)


### Features

* add diffs to stage resource ([657b34a](https://github.com/Chia-Network/climate-warehouse/commit/657b34a33f6e14afe224104bc1f18377860b4942))
* bring models in line with migrations ([6e710e5](https://github.com/Chia-Network/climate-warehouse/commit/6e710e5372041c52f52cc82d7a99dc406052af28))
* bring models in line with migrations ([5c0fdad](https://github.com/Chia-Network/climate-warehouse/commit/5c0fdad56307daadb036edc802289123e734190c))
* create staging resource ([19d5575](https://github.com/Chia-Network/climate-warehouse/commit/19d5575ff04ff56806756c56ee9cb81b638acb49))
* get the database connection working ([1750631](https://github.com/Chia-Network/climate-warehouse/commit/1750631ba83e743813a1dc4e36c906d1b1e97132))
* implement staging crud ([912b316](https://github.com/Chia-Network/climate-warehouse/commit/912b316fcb2647ec458f00f129141eb2fe16d82a))
* model relationship tweaks ([db2a92e](https://github.com/Chia-Network/climate-warehouse/commit/db2a92eb9ce2712578e745d52e885c651ff735e8))
* qualifications tests ([e282581](https://github.com/Chia-Network/climate-warehouse/commit/e282581daee5323d2e243fa333f42061fc32b6a5))
* relationships ([0cd24ce](https://github.com/Chia-Network/climate-warehouse/commit/0cd24ce3e0bae0d3ba98bb3c5bb5d4f23e4df22e))
* set up cors, set up db seed ([7e0766c](https://github.com/Chia-Network/climate-warehouse/commit/7e0766c3b0fe74b97c7cadb7d7216958131f3077))


### Bug Fixes

* spelling ([d1ea528](https://github.com/Chia-Network/climate-warehouse/commit/d1ea528c1e149f003f3b5385f1a2556f37956b86))

### 0.0.1 (2021-12-02)


### Features

* add electron base app ([92b2b72](https://github.com/Chia-Network/climate-warehouse/commit/92b2b728366960aee4d3fb8856d2cb550a0ebbfc))
* add stubs and mocks for all resources ([f68bedf](https://github.com/Chia-Network/climate-warehouse/commit/f68bedfe1c535b7c395dd34669a14310597a5ad0))
* added models and migration scripts ([bdbe84e](https://github.com/Chia-Network/climate-warehouse/commit/bdbe84eace6c67b7509944f602bb80d0414bf76c))
* added sqlite db and migrated tables ([bac2adc](https://github.com/Chia-Network/climate-warehouse/commit/bac2adc3a20cca6017bdc4bc27f35de027cdf2d8))
* api base app ([4336a9f](https://github.com/Chia-Network/climate-warehouse/commit/4336a9ffbe0c817e18ca228a890f6d5096a53959))
* data model, stubs and test for units ([5f64537](https://github.com/Chia-Network/climate-warehouse/commit/5f645372bada2fa5621999779ff296c05e8d8e0d))
* migrate more baseapp features from carbon retirement repo ([804701a](https://github.com/Chia-Network/climate-warehouse/commit/804701aaaabec53ff249fcaa8b4cd0f903c5863b))
* qualifications ([5542ea6](https://github.com/Chia-Network/climate-warehouse/commit/5542ea6c30ab5b133aac4ebccb258e81d332dd73))
* qualifications ([53e63cf](https://github.com/Chia-Network/climate-warehouse/commit/53e63cf2eee0f526455f84ed6ff7e17f10c8bd09))


### Bug Fixes

* co-benifet typo ([0b9a8c1](https://github.com/Chia-Network/climate-warehouse/commit/0b9a8c1019dd587667637e762fbd04fcb1f76e29))
* rename benefits ([6d806c4](https://github.com/Chia-Network/climate-warehouse/commit/6d806c4a7a2d349098b661f91b39a95067fd7977))
* rename benefits ([1d71152](https://github.com/Chia-Network/climate-warehouse/commit/1d7115209830a13daf5e9fa0c5c8a63ffb6dd47f))
* v1router ([bdf5c49](https://github.com/Chia-Network/climate-warehouse/commit/bdf5c498e5960e92d11df268946895e6c4530057))
* v1router ([fe9e6a3](https://github.com/Chia-Network/climate-warehouse/commit/fe9e6a3f4466f726afefd41f0c805b305af9b12d))
