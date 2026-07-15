## steps

- [x] clone project
- [x] install docker, docker compose
- [x] export postgres db
- [x] copy .env
- [x] stop docker compose on blue laptop
- [x] run docker compose on grey laptop
- [x] update DNS on cloudflare
- [x] import postgres db
- [x] check https://ielts.tdbao-brian.work
- [x] write docs

## copy db from docker volume

- find your volume name
```bash
docker volume ls
```

- create the backup archive. Replace `<volume_name>` with your actual volume name.
```bash
docker run --rm \
  -v <volume_name>:/volume_data \
  -v $(pwd):/backup \
  ubuntu tar cvf /backup/volume_backup.tar -C /volume_data .
```

- transfer the `volume_backup.tar` file
```bash
scp volume_backup.tar user@that-laptop-ip:/path/to/destination/
```

- On your destination laptop, create the new volume. Replace `<volume_name>` with your actual volume name.
```bash
docker volume create <new_volume_name>
```

- Extract the backup into the new volume. Replace `<volume_name>` with your actual volume name.
```bash
docker run --rm \
  -v <new_volume_name>:/volume_data \
  -v $(pwd):/backup \
  ubuntu tar xvf /backup/volume_backup.tar -C /volume_data
```
