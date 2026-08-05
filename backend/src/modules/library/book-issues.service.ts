import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookIssueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IssueBookDto, SettleFineDto, FineAction } from './dto/issue-book.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

// Flat overdue fine, per day late. No school-configurable rate yet - this is
// a placeholder until fines get their own settings screen (could then move
// into a FeeHead-like table similar to finance/fee-head).
const LIBRARY_FINE_PER_DAY = 10;

@Injectable()
export class BookIssuesService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(dto: IssueBookDto, currentUser: ScopedUser & { userId: string }) {
    const book = await this.prisma.book.findFirst({ where: { id: dto.bookId, deletedAt: null } });
    if (!book) throw new NotFoundException('Book not found');
    assertSchoolAccess(currentUser, book.schoolId);

    if (book.availableCopies <= 0) {
      throw new ConflictException('No copies of this book are currently available');
    }

    const borrower = await this.prisma.user.findFirst({
      where: { id: dto.borrowerId, deletedAt: null, isActive: true },
    });
    if (!borrower) throw new NotFoundException('Borrower not found or inactive');
    if (borrower.schoolId && borrower.schoolId !== book.schoolId) {
      throw new ConflictException('This person belongs to a different school than the book');
    }

    const openIssue = await this.prisma.bookIssue.findFirst({
      where: { bookId: dto.bookId, borrowerId: dto.borrowerId, status: BookIssueStatus.ISSUED },
    });
    if (openIssue) {
      throw new ConflictException('This person already has this book issued and not yet returned');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.book.update({ where: { id: book.id }, data: { availableCopies: { decrement: 1 } } });
      return tx.bookIssue.create({
        data: {
          bookId: dto.bookId,
          borrowerId: dto.borrowerId,
          issuedById: currentUser.userId,
          issueDate: new Date(),
          dueDate: new Date(dto.dueDate),
        },
      });
    });
  }

  async findAll(
    currentUser: ScopedUser,
    schoolId?: string,
    status?: BookIssueStatus,
    bookId?: string,
    borrowerId?: string,
    overdueOnly?: boolean,
  ) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.bookIssue.findMany({
      where: {
        ...(scopedSchoolId ? { book: { schoolId: scopedSchoolId } } : {}),
        ...(status ? { status } : {}),
        ...(bookId ? { bookId } : {}),
        ...(borrowerId ? { borrowerId } : {}),
        ...(overdueOnly ? { status: BookIssueStatus.ISSUED, dueDate: { lt: new Date() } } : {}),
      },
      include: {
        book: { select: { id: true, title: true, author: true } },
        borrower: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  mine(userId: string) {
    return this.prisma.bookIssue.findMany({
      where: { borrowerId: userId },
      include: { book: { select: { id: true, title: true, author: true } } },
      orderBy: { issueDate: 'desc' },
    });
  }

  async returnBook(id: string, currentUser: ScopedUser) {
    const issue = await this.findIssueOrThrow(id, currentUser);
    if (issue.status !== BookIssueStatus.ISSUED) {
      throw new ConflictException('This book has already been returned or marked lost');
    }

    const returnDate = new Date();
    const daysLate = Math.max(0, Math.ceil((returnDate.getTime() - issue.dueDate.getTime()) / 86_400_000));
    const fineAmount = daysLate * LIBRARY_FINE_PER_DAY;

    return this.prisma.$transaction(async (tx) => {
      await tx.book.update({ where: { id: issue.bookId }, data: { availableCopies: { increment: 1 } } });
      return tx.bookIssue.update({
        where: { id },
        data: { status: BookIssueStatus.RETURNED, returnDate, fineAmount },
      });
    });
  }

  async markLost(id: string, currentUser: ScopedUser) {
    const issue = await this.findIssueOrThrow(id, currentUser);
    if (issue.status !== BookIssueStatus.ISSUED) {
      throw new ConflictException('This issue is not currently active');
    }
    // The copy is gone for good - reduce totalCopies (not availableCopies,
    // which was already decremented when it was issued) so the catalog
    // count stays honest.
    return this.prisma.$transaction(async (tx) => {
      await tx.book.update({ where: { id: issue.bookId }, data: { totalCopies: { decrement: 1 } } });
      return tx.bookIssue.update({ where: { id }, data: { status: BookIssueStatus.LOST } });
    });
  }

  async settleFine(id: string, dto: SettleFineDto, currentUser: ScopedUser) {
    await this.findIssueOrThrow(id, currentUser);
    return this.prisma.bookIssue.update({
      where: { id },
      data:
        dto.action === FineAction.WAIVED
          ? { fineWaived: true, finePaid: false }
          : { finePaid: true, fineWaived: false },
    });
  }

  private async findIssueOrThrow(id: string, currentUser: ScopedUser) {
    const issue = await this.prisma.bookIssue.findFirst({ where: { id }, include: { book: true } });
    if (!issue) throw new NotFoundException('Issue record not found');
    assertSchoolAccess(currentUser, issue.book.schoolId);
    return issue;
  }
}
