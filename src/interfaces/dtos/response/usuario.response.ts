export class UsuarioResponse{
  id: string;
  username: string;
  password: string;
  email: string;
  usuCre: string;
  fecCre: Date;
  usuMod: string;
  fecMod: Date;

  constructor(props:{
    id: string;
    username: string;
    email: string;
    password: string;
    usuCre: string;
    fecCre: Date;
    usuMod: string;
    fecMod: Date;
  }) {
    this.id = props.id;
    this.username = props.username;
    this.email = props.email;
    this.password = props.password;
    this.usuCre = props.usuCre;
    this.fecCre = props.fecCre;
    this.usuMod = props.usuMod;
    this.fecMod = props.fecMod;
  }

  static async create(props: {
    id: string;
    username: string;
    email: string;
    password: string;
    usuCre: string;
    fecCre: Date;
    usuMod: string;
    fecMod: Date;
  }): Promise<UsuarioResponse> {
    return new UsuarioResponse(props)
  }
}