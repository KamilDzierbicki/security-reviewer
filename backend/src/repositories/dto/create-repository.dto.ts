import { IsString, MaxLength } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  @MaxLength(300)
  url: string;
}
