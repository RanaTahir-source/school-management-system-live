import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuizDto, UpdateQuizDto } from './dto/create-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const MANAGER_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'];

function normalizeQuestions(questions: CreateQuizDto['questions']) {
  return questions.map((q, index) => {
    const type = q.type ?? 'MCQ';
    return {
      order: index,
      type,
      text: q.text,
      options: type === 'TRUE_FALSE' ? ['True', 'False'] : q.options ?? [],
      correctAnswer: q.correctAnswer,
      marks: q.marks ?? 1,
    };
  });
}

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  private isManager(user: ScopedUser) {
    return user.roles.some((r) => MANAGER_ROLES.includes(r));
  }

  private async loadOwned(id: string, currentUser: ScopedUser) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, deletedAt: null },
      include: { questions: { orderBy: { order: 'asc' } }, _count: { select: { attempts: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    assertSchoolAccess(currentUser, quiz.schoolId);
    if (!this.isManager(currentUser) && quiz.createdById !== currentUser.userId) {
      throw new ForbiddenException('You can only manage quizzes you created');
    }
    return quiz;
  }

  // ---- Teacher/manager side ----

  async create(dto: CreateQuizDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);

    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: { id: dto.sectionId, deletedAt: null },
        include: { class: true },
      });
      if (!section || section.class.schoolId !== dto.schoolId) {
        throw new NotFoundException('Section not found for this school');
      }
    }

    return this.prisma.quiz.create({
      data: {
        schoolId: dto.schoolId,
        subjectId: dto.subjectId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        title: dto.title,
        description: dto.description,
        timeLimitMinutes: dto.timeLimitMinutes,
        createdById: currentUser.userId!,
        questions: { create: normalizeQuestions(dto.questions) },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  }

  async findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; classId?: string; sectionId?: string; subjectId?: string },
  ) {
    const scopedSchoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.quiz.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
        // A plain TEACHER only sees quizzes they authored; managers see every
        // quiz in scope.
        ...(this.isManager(currentUser) ? {} : { createdById: currentUser.userId }),
      },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    return this.loadOwned(id, currentUser);
  }

  async update(id: string, dto: UpdateQuizDto, currentUser: ScopedUser) {
    const quiz = await this.loadOwned(id, currentUser);

    if (dto.questions) {
      if (quiz.isPublished || quiz._count.attempts > 0) {
        throw new ConflictException(
          'This quiz already has students attempting it (or is published) - unpublish it first if you really need to change its questions.',
        );
      }
      await this.prisma.$transaction([
        this.prisma.quizQuestion.deleteMany({ where: { quizId: id } }),
        this.prisma.quiz.update({
          where: { id },
          data: { questions: { create: normalizeQuestions(dto.questions) } },
        }),
      ]);
    }

    return this.prisma.quiz.update({
      where: { id },
      data: {
        subjectId: dto.subjectId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        title: dto.title,
        description: dto.description,
        timeLimitMinutes: dto.timeLimitMinutes,
        isPublished: dto.isPublished,
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.loadOwned(id, currentUser);
    return this.prisma.quiz.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async attemptsForQuiz(id: string, currentUser: ScopedUser) {
    await this.loadOwned(id, currentUser);
    return this.prisma.quizAttempt.findMany({
      where: { quizId: id },
      include: {
        student: {
          select: { id: true, admissionNo: true, user: { select: { fullName: true } } },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  // ---- Student side ----

  private async requireStudentProfile(currentUser: ScopedUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { userId: currentUser.userId, deletedAt: null },
      include: { section: { select: { id: true, classId: true } } },
    });
    if (!student) throw new ForbiddenException('No student profile linked to your account');
    return student;
  }

  private async quizVisibleToStudent(quizId: string, student: { schoolId?: string | null; sectionId: string | null; section: { classId: string } | null }) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, deletedAt: null, isPublished: true },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found or not published');

    const matchesSection = quiz.sectionId ? quiz.sectionId === student.sectionId : true;
    const matchesClass = !quiz.sectionId && quiz.classId ? quiz.classId === student.section?.classId : true;
    if (!(matchesSection && matchesClass)) {
      throw new ForbiddenException('This quiz is not assigned to your section');
    }
    return quiz;
  }

  async availableForMe(currentUser: ScopedUser) {
    const student = await this.requireStudentProfile(currentUser);
    const studentUser = await this.prisma.user.findUnique({ where: { id: currentUser.userId! }, select: { schoolId: true } });

    const quizzes = await this.prisma.quiz.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        schoolId: studentUser?.schoolId ?? undefined,
        OR: [
          { sectionId: student.sectionId ?? undefined },
          { sectionId: null, classId: student.section?.classId ?? undefined },
          { sectionId: null, classId: null },
        ],
      },
      include: {
        subject: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
        attempts: { where: { studentId: student.id }, select: { status: true, score: true, totalMarks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      subject: q.subject,
      timeLimitMinutes: q.timeLimitMinutes,
      questionCount: q._count.questions,
      myAttempt: q.attempts[0] ?? null,
    }));
  }

  async startAttempt(quizId: string, currentUser: ScopedUser) {
    const student = await this.requireStudentProfile(currentUser);
    const quiz = await this.quizVisibleToStudent(quizId, student);

    let attempt = await this.prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId, studentId: student.id } },
    });
    if (attempt?.status === 'SUBMITTED') {
      throw new ConflictException('You have already submitted this quiz');
    }
    if (!attempt) {
      attempt = await this.prisma.quizAttempt.create({ data: { quizId, studentId: student.id } });
    }

    return {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimitMinutes: quiz.timeLimitMinutes,
        // Correct answers deliberately withheld until submission.
        questions: quiz.questions.map((q) => ({ id: q.id, order: q.order, type: q.type, text: q.text, options: q.options, marks: q.marks })),
      },
    };
  }

  async submitAttempt(quizId: string, dto: SubmitQuizDto, currentUser: ScopedUser) {
    const student = await this.requireStudentProfile(currentUser);
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId, studentId: student.id } },
    });
    if (!attempt) throw new NotFoundException('Start the quiz before submitting it');
    if (attempt.status === 'SUBMITTED') throw new ConflictException('You have already submitted this quiz');

    const questions = await this.prisma.quizQuestion.findMany({ where: { quizId } });
    const byId = new Map(questions.map((q) => [q.id, q]));

    const graded = dto.answers
      .filter((a) => byId.has(a.questionId))
      .map((a) => {
        const question = byId.get(a.questionId)!;
        const isCorrect = !!a.responseText && a.responseText.trim() === question.correctAnswer.trim();
        return {
          attemptId: attempt.id,
          questionId: a.questionId,
          responseText: a.responseText,
          isCorrect,
          marksAwarded: isCorrect ? question.marks : 0,
        };
      });

    const score = graded.reduce((sum, g) => sum + g.marksAwarded, 0);
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    await this.prisma.$transaction([
      this.prisma.quizAnswer.createMany({ data: graded }),
      this.prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), score, totalMarks },
      }),
    ]);

    return this.myResult(quizId, currentUser);
  }

  async myResult(quizId: string, currentUser: ScopedUser) {
    const student = await this.requireStudentProfile(currentUser);
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { quizId_studentId: { quizId, studentId: student.id } },
      include: {
        answers: true,
        quiz: { select: { title: true, questions: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!attempt) throw new NotFoundException('No attempt found for this quiz');

    const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const reviewAllowed = attempt.status === 'SUBMITTED';

    return {
      status: attempt.status,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      submittedAt: attempt.submittedAt,
      quizTitle: attempt.quiz.title,
      questions: attempt.quiz.questions.map((q) => {
        const ans = answersByQuestion.get(q.id);
        return {
          id: q.id,
          text: q.text,
          options: q.options,
          marks: q.marks,
          yourAnswer: ans?.responseText ?? null,
          isCorrect: reviewAllowed ? ans?.isCorrect ?? false : undefined,
          correctAnswer: reviewAllowed ? q.correctAnswer : undefined,
        };
      }),
    };
  }
}
