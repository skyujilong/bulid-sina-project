// 主线逻辑

import {
    help
} from 'yargs';
import * as packageJson from './../package.json';
import cmd from './tools/cmd';
import answerLine, {
    answerLineOk
} from './tools/answer-line';
import {
    transformDir,
    isIllegalGit,
    getGitName,
    urlEndSuff
} from './tools/utils';
import BpConf from './module/bp-conf';
import BuildInfo from './module/buid-info';
import {
    readLine,
    vailDir,
    mkRootDir,
    asyncCopyFile,
    asyncWriteFile
} from './tools/fs';

import {
    join,
    isAbsolute
} from 'path';

let {
    argv
} = help().alias('help', 'h').version().alias('version', 'v').usage([
    '项目地址与说明：https://github.com/skyujilong/sina-bp',
    '版本：' + packageJson.version,
    '用法:',
    '1、配置文件方案: sina-bp -c [你配置文件的地址]',
    '2、非配置文件方案1: sina-bp -d [你要生成项目的地址]',
    '3、非配置文件方案2: sina-bp'
].join('\n')).options({
    dir: {
        alias: 'd',
        describe: '生成项目的路径',
        type: 'string'
    },
    conf: {
        alias: 'c',
        describe: '配置文件地址',
        type: 'string'
    },
    name: {
        alias: 'n',
        describe: '项目名称',
        type: 'string'
    },
    devHost: {
        describe: '测试环境绑定Host',
        type: 'string',
        default: 'test.sina.com.cn'
    }
});




async function getConf(): Promise < BuildInfo > {
    //解析argv参数
    let isCompany: boolean = await answerLineOk('是否是公司项目(y/n):', ['y', 'n']) === 'y';
    let isActivity: boolean = false;
    if (isCompany) {
        isActivity = await answerLineOk('是否是公司的活动项目(y/n)', ['y', 'n']) === 'y';
    }
    let name: string;
    if (isActivity) {
        if (argv.name) {
            name = argv.name;
        } else {
            name = await answerLine('请输入项目名称(英文包含字母以及-_):');
        }
    }

    let bpConf: BpConf;

    // 参数中带有配置文件地址
    if (argv.conf) {
        // 是公司项目。 判断配置文件是否添加到参数上了。
        let confDir = transformDir(argv.conf);
        try {
            bpConf = await readLine(confDir);
        } catch (e) {
            let confDir = await answerLine('配置文件路径输入错误，请输入正确的绝对路径：');
            try {
                bpConf = await readLine(confDir);
            } catch (e) {
                throw e;
            }
        }
    }

    let git: string = '';
    let isIllegalGitFlag = false;
    while (true) {
        if (isCompany && isIllegalGit(git)) {
            git = await answerLine(isIllegalGitFlag ? '请输入合法的git地址（仅支持ssh）:' : '请输入git地址（仅支持ssh）:');
            isIllegalGitFlag = true;
        } else if (!isCompany && (git !== 'n' && isIllegalGit(git))) {
            git = await answerLine(isIllegalGitFlag ? '请输入合法的git地址(仅支持ssh & 输入n为不添加git地址):' : '请输入git地址(仅支持ssh & 输入n为不添加git地址):');
            isIllegalGitFlag = true;
        } else if (git === 'n' && !isCompany) {
            git = '';
            break;
        } else if (!isIllegalGit(git)) {
            break;
        }
    }
    if (isCompany) {
        if (!bpConf) {
            let confDir = await answerLine('请输入配置文件地址:(仅支持绝对路径)');
            try {
                bpConf = await readLine(confDir);
            } catch (e) {
                throw e;
            }
        }
        let buildInfo = new BuildInfo(isActivity ? name : getGitName(git), git, isCompany, isActivity, bpConf);
        if (isAbsolute(bpConf.qbDir)) {
            //删除/ 默认应该不是绝对路径的。
            bpConf.qbDir = bpConf.qbDir.substring(1);
        }
        // 更新qbDir的路径
        bpConf.qbDir = urlEndSuff(bpConf.qbDir, '/') + new Date().getFullYear() + '/' + buildInfo.name + '/';
        return buildInfo;
    } else {
        let testConf = await getTestConf(git, bpConf);
        return testConf;
    }
}

/**
 * 获取本地的练习 构建对象实例子
 * @param git 
 * @param bpConf 
 */
async function getTestConf(git: string, bpConf: BpConf): Promise < BuildInfo > {
    let name: string;
    if (argv.name) {
        name = argv.name;
    } else if (git) {
        name = getGitName(git);
    } else {
        name = await answerLine('请输入项目名称(英文包含字母以及-_):');
    }

    if (bpConf) {
        return new BuildInfo(name, git, false, false, bpConf);
    } else {
        let workspace: string;
        if (!argv.dir) {
            workspace = await answerLine('请输入项目生成地址：');
        } else {
            // 防止win下的 路径输入错误。
            workspace = transformDir(argv.dir);
        }
        let prodHost: string = argv.devHost;
        let prodImgHost: string = argv.devHost;
        let devHost: string = argv.devHost;
        return new BuildInfo(name, git, false, false, new BpConf(workspace, devHost, prodHost, prodImgHost, ['346gfotHJspgPYXmOuSAWhSl4CxlUox7']));
    }
}


async function build(): Promise < string > {

    let buildInfo: BuildInfo = await getConf();
    let projectDir: string;
    if (!buildInfo.isActivity) {
        projectDir = join(buildInfo.bpConf.workspace, buildInfo.name);
        await vailDir(projectDir);
    } else {
        projectDir = join(buildInfo.bpConf.workspace, getGitName(buildInfo.git));
    }
    if (buildInfo.git && !buildInfo.isActivity) {
        await cmd('git', ['clone', buildInfo.git, '--progress'], {
            cwd: buildInfo.bpConf.workspace
        });
    } else if (buildInfo.isActivity) {
        try {
            await vailDir(projectDir);
            //这里根据是否是 活动项目（isActivity）修改一下projectDir路径,并且建立根目录
            projectDir = join(projectDir, buildInfo.name);
            //代表没有下载 git内容。
            await cmd('git', ['clone', buildInfo.git, '--progress'], {
                cwd: buildInfo.bpConf.workspace
            });
            await mkRootDir(projectDir);
        } catch (e) {
            //报出异常了，代表，之前git已经下载过了。
            //这里根据是否是 活动项目（isActivity）修改一下projectDir路径,并且建立根目录
            projectDir = join(projectDir, buildInfo.name);
            await mkRootDir(projectDir);
        }
    } else {
        //建立根目录
        await mkRootDir(projectDir);
    }

    //递归 config文件夹
    await asyncCopyFile(projectDir, '/', buildInfo);

    //npm过去之后，不能够按照预期生成.gitignore文件
    await asyncWriteFile(projectDir, '.gitignore', ['node_modules/', 'jspm_packages/', '.DS_Store', '*.log', '.npm', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', '.DS_Store'].join('\n'));

    //不是activity的 才进行 安装依赖环境
    if (!buildInfo.isActivity){
        //安装项目
        let isUseYarn = await answerLineOk('是否使用yarn安装模块？（y采用yarn安装,n采用npm安装）', ['y', 'n']) === 'y';
        if (isUseYarn) {
            await cmd('yarn', ['install'], {
                cwd: projectDir
            });
        } else {
            await cmd('npm', ['install'], {
                cwd: projectDir
            });
        }
        console.log('项目安装完毕！');
    }
    

    //提交git内容，并且创建一个开发分支
    if (buildInfo.git) {
        if (buildInfo.isActivity) {
            await cmd('git', ['checkout', 'master'], {
                cwd: projectDir
            });
            await cmd('git', ['pull']);
        }
        await cmd('git', ['add', '*'], {
            cwd: projectDir
        });
        await cmd('git', ['commit', '-m', '初始化基础文件！'], {
            cwd: projectDir
        });
        await cmd('git', ['push', 'origin', 'master'], {
            cwd: projectDir
        });
        if(!buildInfo.isActivity){
            await cmd('git', ['checkout', '-b', 'dev'], {
                cwd: projectDir
            });
        }
        console.log('开发分支创建完毕！');
    }
    return `项目地址：${projectDir}`;
}


build().then((dir) => {
    console.log(dir);
}).catch(e => console.log(e));