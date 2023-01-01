cmake --build build
IF %ERRORLEVEL% NEQ 0 (Exit /b 1)
%1\.dos\dosbox-x\dosbox-x -conf %1\.dos\dosbox-x.conf -fastlaunch -exit %2.exe
IF %ERRORLEVEL% NEQ 0 (Exit /b 1)
