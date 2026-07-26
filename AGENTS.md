# Instruções permanentes do projeto

## Som de conclusão

Ao terminar completamente a última ordem solicitada, execute uma única vez no Windows:

```powershell
powershell.exe -NoProfile -Command "[System.Media.SystemSounds]::Asterisk.Play()"
```

Execute o som somente quando:

- A implementação estiver concluída;
- Todos os testes aplicáveis tiverem terminado;
- O resultado final estiver pronto para ser entregue.

Não emita o som durante comandos intermediários.
