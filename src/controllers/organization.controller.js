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
    me: {
      orgUid: 'f1c54511-865e-4611-976c-7c3c1f704662',
      icon: await loadFileIntoString('src/assets/organizationIcons/me.svg'),
    },
    chili: {
      orgUid: '35f92331-c8d7-4e9e-a8d2-cd0a86cbb2cf',
      icon: await loadFileIntoString('src/assets/organizationIcons/chili.svg'),
    },
    belgium: {
      orgUid: 'fbffae6b-0203-4ac0-a08b-1551b730783b',
      icon: await loadFileIntoString(
        'src/assets/organizationIcons/belgium.svg',
      ),
    },
    bulgaria: {
      orgUid: '70150fde-57f6-44a6-9486-1fef49528475',
      icon: await loadFileIntoString(
        'src/assets/organizationIcons/bulgaria.svg',
      ),
    },
  });
};
