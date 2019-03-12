// import path from 'path';
const path = require('path');
const gulp = require('gulp');
const ts = require('gulp-typescript');
let tsProject = ts.createProject('tsconfig.json');
gulp.task('default',()=>{
    let tsResult =  gulp.src('lib/**/*.ts').pipe(tsProject());
    return tsResult.js.pipe(gulp.dest('dist'));
});