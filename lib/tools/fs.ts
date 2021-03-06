import {
    createReadStream, lstat, Stats, mkdir, readdir, createWriteStream, writeFile
} from 'fs';

import { sep, join, resolve } from 'path';

import {
    createInterface
} from 'readline';

import { platform } from 'os';

import BpConf from '../module/bp-conf';

import { transAsyncPromise } from './utils';

import BuildInfo from '../module/buid-info';

import ContentChange from './tpl-pipe';

interface Conf{
    workspace: string
    devHost: string
    prodHost: string
    prodImgHost?: string
    qbDir?:string
    tinyPngKeys: string[]
}

type StringList = string[];

let asyncReadDir = transAsyncPromise(readdir);
let asyncLstat = transAsyncPromise(lstat);
let asyncMkDir = transAsyncPromise(mkdir);

async function readLine(dir: string): Promise<BpConf>{

    return new Promise((resolve,reject)=>{
        let readStream = createReadStream(dir);
        readStream.setEncoding('utf8');
        let readline = createInterface({
            input: readStream
        });
        readStream.on('error',(err)=>{
            reject(new Error('配置文件路径错误！'));
        });
        let conf: Conf = {
            workspace:'',
            devHost:'',
            prodHost:'',
            prodImgHost:'',
            tinyPngKeys:[],
            qbDir:''
        };
        readline.on('line',(text:string):void=>{
            if(text.indexOf('#')==0){
                return;
            }
            let [key,val] = text.split('=');
            if (key == 'tinyPngKeys' && val.indexOf(',') != -1){
                for(let item of val.split(',')){
                    conf.tinyPngKeys.push(item);
                }
            }else{
                conf[key] = val;
            }
        });
        readline.on('close',()=>{
            let {
                workspace,
                devHost,
                prodHost,
                prodImgHost,
                tinyPngKeys,
                qbDir
            } = conf;
            if (!workspace || !devHost || !prodHost){
                reject(new Error('配置文件至少需要如下参数：workspace,devHost,prodHost'));
            }
            let bpConf: BpConf = new BpConf(workspace, devHost, prodHost, prodImgHost, tinyPngKeys, qbDir);
            resolve(bpConf);
        });
    });
}

async function vailDir(location:string){
    let isThrowError = false;
    try{
        let stats = await asyncLstat(location);
        if(stats.isDirectory()){
            isThrowError = true;
        }
    }catch(e){
        
    }
    if (isThrowError){
        throw new Error(`${location}该路径已经存在了！请更换地址。`);
    }
}

/**
 * 处理根目录
 * @param location 
 */
async function mkRootDir(location:string):Promise<void>{
    let list:string[] = location.split(sep);
    let currentDir:string;
    for(let i = 0; i<list.length; i++){
        if(i === 0){
            currentDir = list[i];
            if (platform() !== 'win32') {
                currentDir = '/' + currentDir;
            }
            continue;
        }
        currentDir = join(currentDir,list[i]);
        try {
            // await asyncMkDir(currentDir);
            await transAsyncPromise(mkdir)(currentDir);
        } catch (error) {
            continue;
        }
    }
}

/**
 * 
 * @param copyFrom 从哪里进行拷贝
 * @param copyTarget 写入到哪里去
 * @param buildInfo 构建信息
 */
async function copy(copyFrom: string, copyTarget: string, buildInfo: BuildInfo):Promise<void>{
    return new Promise((resolve,reject)=>{
        let readStream = createReadStream(copyFrom);
        readStream.setEncoding('utf8');
        let writeStream = createWriteStream(copyTarget);
        writeStream.setDefaultEncoding('utf8');
        let transTpl = new ContentChange({
            data: buildInfo
        });
        transTpl.setEncoding('utf8');
        writeStream.on('finish',()=>{
            resolve();
        });
        readStream.on('error',(err)=>{
            reject(err);
        });
        writeStream.on('error',(err)=>{
            reject(err);
        })
        readStream.pipe(transTpl).pipe(writeStream);
    });
}

/**
 * 拷贝文件以及文件夹
 * @param targetDir 目标要拷贝到的文件夹
 * @param relativePath 相对路径
 */
async function asyncCopyFile(targetDir: string, relativePath: string, buildInfo:BuildInfo ): Promise < void > {
    //配置文件根目录
    let confDir = resolve(__dirname, '..', '..', 'config');
    //配置文件+ 相对路径，下的所有文件
    let dirStats: StringList = await asyncReadDir(join(confDir, relativePath));
    for (let name of dirStats) {
        let stats: Stats = await asyncLstat(join(confDir, relativePath, name));
        if (stats.isDirectory()) {
            await asyncMkDir(join(targetDir, relativePath, name));
            await asyncCopyFile(targetDir, join(relativePath, name), buildInfo);
        } else if (stats.isFile()) {
            await copy(join(confDir, relativePath, name), join(targetDir, relativePath, name), buildInfo);
        }
    }
}

function writeFilePro(fileDir:string,content:string):Promise<void>{
    return new Promise((resolve,reject)=>{
        writeFile(fileDir, content,{
            encoding:'utf-8'
        },(err)=>{
            if(err){
                reject(err);
            }else{
                resolve();
            }
        })
    });
}

/**
 * 写文件操作
 * @param targetDir 写如的文件夹
 * @param fileName 文件名称
 * @param fileContent 文件内容
 */
async function asyncWriteFile(targetDir:string,fileName:string, fileContent:string): Promise<void> {
    let fileDir = join(targetDir,fileName);
    await writeFilePro(fileDir,fileContent);
}


export {
    readLine,
    asyncLstat,
    mkRootDir,
    vailDir,
    asyncCopyFile,
    asyncWriteFile
}