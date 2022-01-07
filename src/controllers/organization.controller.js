import fs from 'fs';

const loadFileIntoString = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, buff) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(buff.toString());
      resolve(buff.toString());
    });
  });
};

export const findAll = async (req, res) => {
  return res.json({
    'f1c54511-865e-4611-976c-7c3c1f704662': {
      name: 'Chia',
      icon: await loadFileIntoString('src/assets/organizationIcons/me.svg'),
      writeAccess: true,
    },
    '35f92331-c8d7-4e9e-a8d2-cd0a86cbb2cf': {
      name: 'chili',
      icon: await loadFileIntoString('src/assets/organizationIcons/chili.svg'),
    },
    'fbffae6b-0203-4ac0-a08b-1551b730783b': {
      name: 'belgium',
      icon: await loadFileIntoString(
        'src/assets/organizationIcons/belgium.svg',
      ),
    },
    '70150fde-57f6-44a6-9486-1fef49528475': {
      name: 'bulgaria',
      icon: await loadFileIntoString(
        'src/assets/organizationIcons/bulgaria.svg',
      ),
    },
  });
};
