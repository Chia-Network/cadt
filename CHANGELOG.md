# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
