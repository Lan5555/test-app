export class Users{
     email:string = '';
     name:string = ''
     id:number = 0;
     code:string = ''
     codeInfo:Record<string,any> = {}
     score:number = 0;

    constructor(email:string,name:string,id:number,code:string,codeInfo:Record<string,any>, score:number){
        this.email = email,
        this.name = name,
        this.id = id,
        this.code = code,
        this.codeInfo = codeInfo
        this.score = score;
    }

    static fromJson(json:Record<string,any>){
        return new Users(
            json.email,
            json.name,
            json.id,
            json.code,
            json.codeInfo,
            json.score
        )
    }
}

export interface QuestionItem {
  question: string;
  options: string[];
  correct: number;
}

export class QuestionFactory {
  id: number;
  name: string;
  code: string;
  totalQuestions: number;
  question: QuestionItem[];
  createdAt: Date;

  constructor(data: Partial<QuestionFactory>) {
    this.id = data.id ?? 0;
    this.name = data.name ?? '';
    this.code = data.code ?? '';
    this.totalQuestions = data.totalQuestions ?? 0;
    // Ensure each item conforms to QuestionItem
    this.question = (data.question ?? []).map(q => ({
      question: q.question ?? '',
      options: q.options ?? [],
      correct: q.correct ?? 0,
    }));
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  }

  /** Helper: create from API response */
  static fromApi(data: any): QuestionFactory {
    if (Array.isArray(data)) {
      // If API returns multiple questions, map them
      return data.map((item: any) => new QuestionFactory({
        id: item.id,
        name: item.name,
        code: String(item.code),
        totalQuestions: Number(item.totalQuestions),
        question: item.question,
        createdAt: item.createdAt,
      })) as any;
    }
    return new QuestionFactory({
      id: data.id,
      name: data.name,
      code: String(data.code),
      totalQuestions: Number(data.totalQuestions),
      question: data.question,
      createdAt: data.createdAt,
    });
  }
}
