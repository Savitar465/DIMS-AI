import { Module } from '@nestjs/common';
import {TypeOrmModule} from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from '@nestjs/config';
import {DatabaseConfig} from "../../../infraestructure/shared/config/database.config";

@Module({
    imports:[
        ConfigModule,
        TypeOrmModule.forRootAsync({
            useFactory: (config: ConfigService) => {
                const database = config.get<DatabaseConfig>('database')
                return {
                    type: 'mongodb',
                    host: database.host,
                    port: database.port,
                    username: database.user,
                    password: database.password,
                    database: database.name,
                    authSource: 'admin',
                    autoLoadEntities: true,
                    synchronize: false,
                }
            },
            inject: [ConfigService],
        })
    ],
    exports: [
        TypeOrmModule
    ]
})
export class MongoDatabaseModule {}
